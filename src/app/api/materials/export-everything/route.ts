import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { divisionCode } from "@/config/company";
import {
  collectReferenceTaxCodeIds,
  type ExportCategoryTaxRow,
  type StripeTaxCodeRef,
} from "@/features/materials/category-tax-io";
import type { ExportAssignmentRow } from "@/features/materials/attribute-assignment-io";
import type { ExportAttribute } from "@/features/materials/attribute-io";
import type { ExportDomainRow } from "@/features/materials/domain-io";
import type { ExportDomain } from "@/features/materials/io";
import {
  buildExportEverythingWorkbookBuffer,
  type CatalogScopeExport,
} from "@/features/materials/export-everything";
import { scopeCodeFor } from "@/features/materials/scope-code";
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

  const [
    domainsDb,
    categoriesDb,
    materialDomains,
    attributesDb,
    assignmentsDb,
    itemTaxIds,
  ] = await Promise.all([
    prisma.materialDomain.findMany({
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
    }),
    prisma.materialCategory.findMany({
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
        stripeTaxCode: { select: { name: true } },
        laborInstallTaxCode: { select: { name: true } },
        laborServiceTaxCode: { select: { name: true } },
      },
    }),
    prisma.materialDomain.findMany({
      orderBy: [
        { division: { name: "asc" } },
        { segment: "asc" },
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      select: {
        name: true,
        sortOrder: true,
        segment: true,
        division: { select: { slug: true } },
        categories: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            name: true,
            sortOrder: true,
            items: {
              orderBy: { name: "asc" },
              select: {
                name: true,
                laborUnits: true,
                laborUnitNotes: true,
                stripeTaxCodeId: true,
                laborInstallTaxCodeId: true,
                laborServiceTaxCodeId: true,
                unit: { select: { code: true } },
              },
            },
          },
        },
      },
    }),
    prisma.materialAttribute.findMany({
      orderBy: { slug: "asc" },
      include: {
        options: {
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        },
      },
    }),
    prisma.materialAttributeAssignment.findMany({
      orderBy: [
        { category: { domain: { name: "asc" } } },
        { category: { name: "asc" } },
        { sortOrder: "asc" },
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
        attribute: { select: { slug: true } },
        defaultOption: { select: { label: true } },
      },
    }),
    prisma.materialItem.findMany({
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
    }),
  ]);

  const domainsFlat: ExportDomainRow[] = domainsDb.map((d) => ({
    division: d.division.name,
    segment: d.segment,
    name: d.name,
    slug: d.slug,
    sortOrder: d.sortOrder,
  }));

  const categoriesTax: ExportCategoryTaxRow[] = categoriesDb.map((c) => ({
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

  const usedIds = [
    ...categoriesDb.flatMap((c) => [
      c.stripeTaxCodeId,
      c.laborInstallTaxCodeId,
      c.laborServiceTaxCodeId,
    ]),
    ...itemTaxIds.flatMap((i) => [
      i.stripeTaxCodeId,
      i.laborInstallTaxCodeId,
      i.laborServiceTaxCodeId,
    ]),
  ];
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

  // Group catalog domains by division+segment scope
  const scopeMap = new Map<string, CatalogScopeExport>();
  for (const d of materialDomains) {
    const code = scopeCodeFor(divisionCode(d.division.slug), d.segment);
    let scope = scopeMap.get(code);
    if (!scope) {
      scope = { scopeCode: code, domains: [] };
      scopeMap.set(code, scope);
    }
    const exportDomain: ExportDomain = {
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
          stripeTaxCodeId: item.stripeTaxCodeId,
          laborInstallTaxCodeId: item.laborInstallTaxCodeId,
          laborServiceTaxCodeId: item.laborServiceTaxCodeId,
        })),
      })),
    };
    scope.domains.push(exportDomain);
  }

  const attributes: ExportAttribute[] = attributesDb.map((a) => ({
    slug: a.slug,
    name: a.name,
    options: a.options.map((o) => ({
      label: o.label,
      sortOrder: o.sortOrder,
    })),
  }));

  const assignments: ExportAssignmentRow[] = assignmentsDb.map((a) => ({
    domain: a.category.domain.name,
    category: a.category.name,
    attribute: a.attribute.slug,
    isRequired: a.isRequired,
    isFilterable: a.isFilterable,
    isVariantDefining: a.isVariantDefining,
    defaultOption: a.defaultOption?.label ?? null,
    sortOrder: a.sortOrder,
  }));

  const buffer = await buildExportEverythingWorkbookBuffer({
    domainsFlat,
    categoriesTax,
    taxRefs,
    catalogScopes: [...scopeMap.values()],
    attributes,
    assignments,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="materials_everything_${todayStamp()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
