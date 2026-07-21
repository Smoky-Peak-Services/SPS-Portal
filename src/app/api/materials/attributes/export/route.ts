import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  attributeListsExportFileName,
  buildAttributeExportWorkbookBuffer,
  type ExportAttribute,
} from "@/features/materials/attribute-io";
import { resolveStorageScope } from "@/features/materials/scope";
import { loadPermissionSubject, subjectCan } from "@/lib/permission-subject";

const SEGMENTS = new Set(["COMMERCIAL", "RESIDENTIAL", "STR"]);

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

  const attributes = await prisma.materialAttribute.findMany({
    where: { divisionId, segment: resolved.storageSegment },
    orderBy: { slug: "asc" },
    include: {
      options: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      },
    },
  });

  const exportAttrs: ExportAttribute[] = attributes.map((a) => ({
    slug: a.slug,
    name: a.name,
    options: a.options.map((o) => ({
      label: o.label,
      sortOrder: o.sortOrder,
    })),
  }));

  const buffer = await buildAttributeExportWorkbookBuffer(exportAttrs);
  const filename = attributeListsExportFileName(resolved.scopeCode);

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
