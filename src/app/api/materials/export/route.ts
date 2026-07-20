import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Segment } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { divisionCode } from "@/config/company";
import {
  buildExportWorkbookBuffer,
  type ExportDomain,
} from "@/features/materials/io";
import { exportFileName, scopeCodeFor } from "@/features/materials/scope-code";
import {
  loadPermissionSubject,
  subjectCan,
} from "@/lib/permission-subject";

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
  const segment = segmentRaw as Segment;

  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, slug: true, segments: true },
  });
  if (!division) {
    return NextResponse.json({ error: "Division not found" }, { status: 404 });
  }
  const allowsSegment = division.segments.some((s) => {
    if (s === "commercial" || s === "COMMERCIAL") return segment === "COMMERCIAL";
    if (s === "residential" || s === "RESIDENTIAL")
      return segment === "RESIDENTIAL";
    if (s === "str" || s === "STR") return segment === "STR";
    return false;
  });
  if (!allowsSegment) {
    return NextResponse.json(
      { error: "Segment not enabled for division" },
      { status: 400 },
    );
  }

  const domains = await prisma.materialDomain.findMany({
    where: { divisionId, segment },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          items: {
            include: { unit: { select: { code: true } } },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  const exportDomains: ExportDomain[] = domains.map((d) => ({
    name: d.name,
    sortOrder: d.sortOrder,
    categories: d.categories.map((c) => ({
      name: c.name,
      sortOrder: c.sortOrder,
      items: c.items.map((item) => ({
        name: item.name,
        unitCode: item.unit.code,
        laborUnits: item.laborUnits.toString(),
        laborUnitNotes: item.laborUnitNotes,
      })),
    })),
  }));

  const buffer = await buildExportWorkbookBuffer(exportDomains);
  const scopeCode = scopeCodeFor(divisionCode(division.slug), segment);
  const filename = exportFileName(scopeCode);

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
