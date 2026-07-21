import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildCategoryTaxWorkbookBuffer,
  collectReferenceTaxCodeIds,
  type ExportCategoryTaxRow,
  type StripeTaxCodeRef,
} from "@/features/materials/category-tax-io";
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

  const categories = await prisma.materialCategory.findMany({
    orderBy: [{ domain: { name: "asc" } }, { name: "asc" }],
    select: {
      name: true,
      slug: true,
      taxProfile: true,
      taxReviewed: true,
      stripeTaxCodeId: true,
      laborInstallTaxCodeId: true,
      laborServiceTaxCodeId: true,
      domain: { select: { name: true } },
      stripeTaxCode: { select: { id: true, name: true } },
      laborInstallTaxCode: { select: { id: true, name: true } },
      laborServiceTaxCode: { select: { id: true, name: true } },
    },
  });

  const usedIds = categories.flatMap((c) => [
    c.stripeTaxCodeId,
    c.laborInstallTaxCodeId,
    c.laborServiceTaxCodeId,
  ]);
  // Also include item-level overrides so the reference sheet stays useful
  const itemCodes = await prisma.materialItem.findMany({
    where: {
      OR: [
        { stripeTaxCodeId: { not: null } },
        { laborInstallTaxCodeId: { not: null } },
        { laborServiceTaxCodeId: { not: null } },
      ],
    },
    select: {
      stripeTaxCodeId: true,
      laborInstallTaxCodeId: true,
      laborServiceTaxCodeId: true,
    },
  });
  for (const i of itemCodes) {
    usedIds.push(
      i.stripeTaxCodeId,
      i.laborInstallTaxCodeId,
      i.laborServiceTaxCodeId,
    );
  }

  const refIds = collectReferenceTaxCodeIds(usedIds);
  const refsDb = await prisma.stripeTaxCode.findMany({
    where: { id: { in: refIds } },
    select: { id: true, name: true, description: true },
    orderBy: { id: "asc" },
  });
  const taxRefs: StripeTaxCodeRef[] = refsDb.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
  }));

  const exportRows: ExportCategoryTaxRow[] = categories.map((c) => ({
    domain: c.domain.name,
    category: c.name,
    slug: c.slug,
    taxProfile: c.taxProfile,
    taxReviewed: c.taxReviewed,
    stripeTaxCodeId: c.stripeTaxCodeId,
    stripeTaxCodeName: c.stripeTaxCode?.name ?? null,
    laborInstallTaxCodeId: c.laborInstallTaxCodeId,
    laborInstallTaxCodeName: c.laborInstallTaxCode?.name ?? null,
    laborServiceTaxCodeId: c.laborServiceTaxCodeId,
    laborServiceTaxCodeName: c.laborServiceTaxCode?.name ?? null,
  }));

  const buffer = await buildCategoryTaxWorkbookBuffer({
    categories: exportRows,
    taxRefs,
  });
  const filename = `categories_tax_${todayStamp()}.xlsx`;

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
