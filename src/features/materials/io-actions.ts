"use server";

import { revalidatePath } from "next/cache";
import type { Segment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertImportExport,
  requireMaterialsAccess,
} from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { divisionCode } from "@/config/company";
import {
  parseWorkbookBuffer,
  planImport,
  summarizePlan,
  type ExistingSnapshot,
  type ImportPlan,
} from "./io";
import { parseScopeFromFilename, scopeCodeFor } from "./scope-code";

const SEGMENTS = new Set<string>(["COMMERCIAL", "RESIDENTIAL", "STR"]);

function revalidateMaterialsIo() {
  for (const p of [
    "/materials",
    "/materials/domains",
    "/materials/categories",
    "/materials/items",
    "/materials/import-export",
  ]) {
    revalidatePath(p);
  }
}

function asSegment(raw: string): Segment {
  if (!SEGMENTS.has(raw)) {
    throw new Error(`Invalid segment: ${raw}`);
  }
  return raw as Segment;
}

async function readFileBuffer(formData: FormData): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing file upload");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("File must be a .xlsx workbook");
  }
  const ab = await file.arrayBuffer();
  return { buffer: Buffer.from(ab), filename: file.name };
}

function scopeFromForm(formData: FormData): {
  divisionId: string;
  segment: Segment;
} {
  const divisionId = String(formData.get("divisionId") ?? "").trim();
  const segment = asSegment(String(formData.get("segment") ?? "").trim());
  if (!divisionId) throw new Error("divisionId is required");
  return { divisionId, segment };
}

async function loadExistingSnapshot(
  divisionId: string,
  segment: Segment,
): Promise<ExistingSnapshot> {
  const [units, domains] = await Promise.all([
    prisma.materialUnit.findMany({
      select: { id: true, code: true },
    }),
    prisma.materialDomain.findMany({
      where: { divisionId, segment },
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
            sortOrder: true,
            items: {
              select: {
                id: true,
                name: true,
                laborUnits: true,
                laborUnitNotes: true,
                unit: { select: { code: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const categories: ExistingSnapshot["categories"] = [];
  const items: ExistingSnapshot["items"] = [];
  for (const d of domains) {
    for (const c of d.categories) {
      categories.push({
        id: c.id,
        domainId: d.id,
        domainSlug: d.slug,
        name: c.name,
        slug: c.slug,
        sortOrder: c.sortOrder,
      });
      for (const item of c.items) {
        items.push({
          id: item.id,
          categoryId: c.id,
          domainSlug: d.slug,
          categorySlug: c.slug,
          name: item.name,
          unitCode: item.unit.code,
          laborUnits: item.laborUnits.toString(),
          laborUnitNotes: item.laborUnitNotes,
        });
      }
    }
  }

  return {
    units,
    domains: domains.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      sortOrder: d.sortOrder,
    })),
    categories,
    items,
  };
}

export type MaterialsImportPreview = {
  filename: string;
  divisionId: string;
  segment: Segment;
  scopeCode: string;
  filenameGuess: ReturnType<typeof parseScopeFromFilename>;
  summary: ReturnType<typeof summarizePlan>;
  plan: ImportPlan;
};

async function buildPreview(
  formData: FormData,
): Promise<MaterialsImportPreview> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  const { divisionId, segment } = scopeFromForm(formData);
  const { buffer, filename } = await readFileBuffer(formData);

  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, slug: true, name: true, segments: true },
  });
  if (!division) throw new Error("Division not found");
  if (!divisionAllowsSegment(division.segments, segment)) {
    throw new Error(
      `Segment ${segment} is not enabled for division ${division.name}`,
    );
  }

  const parsed = await parseWorkbookBuffer(buffer);
  const existing = await loadExistingSnapshot(divisionId, segment);
  const plan = planImport(existing, parsed);
  const code = divisionCode(division.slug);

  return {
    filename,
    divisionId,
    segment,
    scopeCode: scopeCodeFor(code, segment),
    filenameGuess: parseScopeFromFilename(filename),
    summary: summarizePlan(plan),
    plan,
  };
}

export async function previewMaterialsImport(
  formData: FormData,
): Promise<MaterialsImportPreview> {
  return buildPreview(formData);
}

export type MaterialsImportCommitResult = {
  summary: ReturnType<typeof summarizePlan>;
  applied: {
    domainsCreated: number;
    categoriesCreated: number;
    unitsCreated: number;
    itemsCreated: number;
    itemsUpdated: number;
  };
};

export async function commitMaterialsImport(
  formData: FormData,
): Promise<MaterialsImportCommitResult> {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  // Commit is admin-grade: require force_delete-level trust (catalog structure)
  if (!userCan(user, "materials.force_delete")) {
    throw new Error("Only users with force-delete permission can commit materials imports");
  }

  // Re-parse — never trust a client-echoed plan.
  const preview = await buildPreview(formData);
  if (!preview.plan.layoutOk) {
    throw new Error(
      preview.plan.layoutMessage ??
        "This file doesn't look like a materials catalog export.",
    );
  }
  const { divisionId, segment, plan } = preview;

  const applied = await prisma.$transaction(async (tx) => {
    const unitIdByCode = new Map<string, string>();
    const existingUnits = await tx.materialUnit.findMany({
      select: { id: true, code: true },
    });
    for (const u of existingUnits) {
      unitIdByCode.set(u.code.toUpperCase(), u.id);
    }

    let unitsCreated = 0;
    for (const u of plan.unitCreates) {
      const created = await tx.materialUnit.create({
        data: { code: u.code, name: u.code },
      });
      unitIdByCode.set(u.code, created.id);
      unitsCreated += 1;
    }

    async function resolveUnitId(code: string): Promise<string> {
      const upper = code.toUpperCase();
      const id = unitIdByCode.get(upper);
      if (id) return id;
      const created = await tx.materialUnit.create({
        data: { code: upper, name: upper },
      });
      unitIdByCode.set(upper, created.id);
      return created.id;
    }

    const domainIdBySlug = new Map<string, string>();
    const existingDomains = await tx.materialDomain.findMany({
      where: { divisionId, segment },
      select: { id: true, slug: true, sortOrder: true },
    });
    let nextDomainSort =
      existingDomains.reduce((m, d) => Math.max(m, d.sortOrder), -1) + 1;
    for (const d of existingDomains) {
      domainIdBySlug.set(d.slug, d.id);
    }

    let domainsCreated = 0;
    for (const d of plan.domainCreates) {
      const created = await tx.materialDomain.create({
        data: {
          divisionId,
          segment,
          name: d.name,
          slug: d.slug,
          sortOrder: nextDomainSort++,
        },
      });
      domainIdBySlug.set(d.slug, created.id);
      domainsCreated += 1;
    }

    const categoryIdByKey = new Map<string, string>();
    const existingCats = await tx.materialCategory.findMany({
      where: { domain: { divisionId, segment } },
      select: {
        id: true,
        slug: true,
        sortOrder: true,
        domain: { select: { slug: true } },
      },
    });
    const nextCatSortByDomain = new Map<string, number>();
    for (const c of existingCats) {
      categoryIdByKey.set(`${c.domain.slug}|${c.slug}`, c.id);
      const cur = nextCatSortByDomain.get(c.domain.slug) ?? -1;
      nextCatSortByDomain.set(c.domain.slug, Math.max(cur, c.sortOrder));
    }

    let categoriesCreated = 0;
    for (const c of plan.categoryCreates) {
      const domainId = domainIdBySlug.get(c.domainSlug);
      if (!domainId) {
        throw new Error(`Missing domain for category ${c.name}`);
      }
      const next =
        (nextCatSortByDomain.get(c.domainSlug) ?? -1) + 1;
      nextCatSortByDomain.set(c.domainSlug, next);
      const created = await tx.materialCategory.create({
        data: {
          domainId,
          name: c.name,
          slug: c.slug,
          sortOrder: next,
        },
      });
      categoryIdByKey.set(`${c.domainSlug}|${c.slug}`, created.id);
      categoriesCreated += 1;
    }

    let itemsCreated = 0;
    for (const item of plan.itemCreates) {
      const categoryId = categoryIdByKey.get(
        `${item.domainSlug}|${item.categorySlug}`,
      );
      if (!categoryId) {
        // Category may have pre-existed
        const domainId = domainIdBySlug.get(item.domainSlug);
        if (!domainId) {
          throw new Error(`Missing domain for item ${item.name}`);
        }
        const cat = await tx.materialCategory.findUnique({
          where: {
            domainId_slug: { domainId, slug: item.categorySlug },
          },
          select: { id: true },
        });
        if (!cat) {
          throw new Error(
            `Missing category ${item.categorySlug} for item ${item.name}`,
          );
        }
        categoryIdByKey.set(
          `${item.domainSlug}|${item.categorySlug}`,
          cat.id,
        );
      }
      const catId = categoryIdByKey.get(
        `${item.domainSlug}|${item.categorySlug}`,
      )!;
      const unitId = await resolveUnitId(item.unitCode);
      await tx.materialItem.create({
        data: {
          categoryId: catId,
          unitId,
          name: item.name,
          laborUnits: new Prisma.Decimal(item.laborUnits),
          laborUnitNotes: item.laborUnitNotes,
        },
      });
      itemsCreated += 1;
    }

    let itemsUpdated = 0;
    for (const item of plan.itemUpdates) {
      const unitId = await resolveUnitId(item.unitCode);
      await tx.materialItem.update({
        where: { id: item.id },
        data: {
          unitId,
          laborUnits: new Prisma.Decimal(item.laborUnits),
          laborUnitNotes: item.laborUnitNotes,
        },
      });
      itemsUpdated += 1;
    }

    return {
      domainsCreated,
      categoriesCreated,
      unitsCreated,
      itemsCreated,
      itemsUpdated,
    };
  });

  revalidateMaterialsIo();
  return { summary: preview.summary, applied };
}

/** Division.segments stores company.ts lowercase values; MaterialDomain uses Prisma Segment. */
function companySegToPrisma(seg: string): Segment | null {
  if (seg === "commercial" || seg === "COMMERCIAL") return "COMMERCIAL";
  if (seg === "residential" || seg === "RESIDENTIAL") return "RESIDENTIAL";
  if (seg === "str" || seg === "STR") return "STR";
  return null;
}

function divisionAllowsSegment(
  divisionSegments: string[],
  segment: Segment,
): boolean {
  return divisionSegments.some((s) => companySegToPrisma(s) === segment);
}

export async function listImportExportScopes() {
  const user = await requireMaterialsAccess();
  assertImportExport(user);
  const divisions = await prisma.division.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, segments: true },
  });
  return divisions.map((d) => {
    const scopes = d.segments
      .map((s) => companySegToPrisma(s))
      .filter((s): s is Segment => s != null)
      .map((segment) => ({
        segment,
        scopeCode: scopeCodeFor(divisionCode(d.slug), segment),
      }));
    return {
      ...d,
      code: divisionCode(d.slug),
      scopes,
    };
  });
}
