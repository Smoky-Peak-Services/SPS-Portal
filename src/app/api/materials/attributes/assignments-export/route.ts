import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAssignmentWorkbookBuffer,
  type ExportAssignmentRow,
} from "@/features/materials/attribute-assignment-io";
import { resolveStorageScope } from "@/features/materials/scope";
import { loadPermissionSubject, subjectCan } from "@/lib/permission-subject";

const SEGMENTS = new Set(["COMMERCIAL", "RESIDENTIAL", "STR"]);

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subject = await loadPermissionSubject(session.user.id);
  if (!subject || !subjectCan(subject, "materials.import_export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const divisionId = req.nextUrl.searchParams.get("divisionId")?.trim() ?? "";
  const segmentRaw = req.nextUrl.searchParams.get("segment")?.trim() ?? "";
  if (!divisionId || !SEGMENTS.has(segmentRaw)) {
    return NextResponse.json(
      { error: "divisionId and segment are required" },
      { status: 400 },
    );
  }

  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, slug: true },
  });
  if (!division) {
    return NextResponse.json({ error: "Division not found" }, { status: 404 });
  }

  let resolved;
  try {
    resolved = resolveStorageScope(division.slug, segmentRaw);
  } catch {
    return NextResponse.json(
      { error: "Segment not valid for division" },
      { status: 400 },
    );
  }

  const assignments = await prisma.materialAttributeAssignment.findMany({
    where: {
      category: {
        domain: { divisionId, segment: resolved.storageSegment },
      },
    },
    orderBy: [
      { category: { domain: { name: "asc" } } },
      { category: { name: "asc" } },
      { sortOrder: "asc" },
      { attribute: { name: "asc" } },
    ],
    select: {
      isRequired: true,
      isFilterable: true,
      isVariantDefining: true,
      sortOrder: true,
      category: {
        select: {
          name: true,
          domain: { select: { name: true } },
        },
      },
      attribute: { select: { name: true, slug: true } },
      defaultOption: { select: { label: true } },
    },
  });

  const rows: ExportAssignmentRow[] = assignments.map((a) => ({
    domain: a.category.domain.name,
    category: a.category.name,
    attribute: a.attribute.slug,
    isRequired: a.isRequired,
    isFilterable: a.isFilterable,
    isVariantDefining: a.isVariantDefining,
    defaultOption: a.defaultOption?.label ?? null,
    sortOrder: a.sortOrder,
  }));

  const buffer = await buildAssignmentWorkbookBuffer(rows);
  const filename = `attribute_assignments_${resolved.scopeCode}_${todayStamp()}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
