import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildDomainWorkbookBuffer,
  type ExportDomainRow,
} from "@/features/materials/domain-io";
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

  const domains = await prisma.materialDomain.findMany({
    orderBy: [
      { division: { name: "asc" } },
      { segment: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      name: true,
      slug: true,
      sortOrder: true,
      segment: true,
      division: { select: { name: true } },
    },
  });

  const rows: ExportDomainRow[] = domains.map((d) => ({
    division: d.division.name,
    segment: d.segment,
    name: d.name,
    slug: d.slug,
    sortOrder: d.sortOrder,
  }));

  const buffer = await buildDomainWorkbookBuffer(rows);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="domains_${todayStamp()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
