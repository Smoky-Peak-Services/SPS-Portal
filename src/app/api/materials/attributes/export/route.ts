import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccess } from "@/config/permissions";
import {
  attributeListsExportFileName,
  buildAttributeExportWorkbookBuffer,
  type ExportAttribute,
} from "@/features/materials/attribute-io";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !canAccess(user.role, "materials")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const attributes = await prisma.materialAttribute.findMany({
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
  const filename = attributeListsExportFileName();

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
