import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAssignmentWorkbookBuffer,
  type ExportAssignmentRow,
} from "@/features/materials/attribute-assignment-io";
import {
  loadPermissionSubject,
  subjectCan,
} from "@/lib/permission-subject";

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

  const assignments = await prisma.materialAttributeAssignment.findMany({
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
  const filename = `attribute_assignments_${todayStamp()}.xlsx`;

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
