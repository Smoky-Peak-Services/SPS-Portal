import type { PrismaClient, Segment } from "@prisma/client";
import { CORE_CATEGORY_ATTRIBUTE_SLUGS } from "./attribute-list-defs";

export type EnsureCoreAssignmentsResult = {
  scopesUpdated: number;
  categoriesUpdated: number;
};

type CoreAttributeIds = { manufacturerId: string; partNumberId: string };

/**
 * Ensure manufacturer (SELECT, always required) and part_number (TEXT,
 * required iff category.requiresManualPartNumber) exist *in the given scope*
 * (attributes are per-scope since prompt 14).
 */
export async function ensureCoreCatalogAttributes(
  prisma: PrismaClient,
  divisionId: string,
  segment: Segment,
): Promise<CoreAttributeIds> {
  const manufacturer = await prisma.materialAttribute.upsert({
    where: {
      divisionId_segment_slug: { divisionId, segment, slug: "manufacturer" },
    },
    create: {
      divisionId,
      segment,
      slug: "manufacturer",
      name: "Manufacturer",
      inputType: "SELECT",
      isActive: true,
    },
    update: {
      name: "Manufacturer",
      inputType: "SELECT",
      isActive: true,
    },
  });

  const partNumber = await prisma.materialAttribute.upsert({
    where: {
      divisionId_segment_slug: { divisionId, segment, slug: "part_number" },
    },
    create: {
      divisionId,
      segment,
      slug: "part_number",
      name: "Part Number",
      inputType: "TEXT",
      isActive: true,
    },
    update: {
      name: "Part Number",
      inputType: "TEXT",
      isActive: true,
    },
  });

  return { manufacturerId: manufacturer.id, partNumberId: partNumber.id };
}

export async function ensureCoreAssignmentsForCategory(
  prisma: PrismaClient,
  categoryId: string,
  requiresManualPartNumber: boolean,
  ids?: CoreAttributeIds,
): Promise<void> {
  let resolved = ids;
  if (!resolved) {
    const category = await prisma.materialCategory.findUnique({
      where: { id: categoryId },
      select: { domain: { select: { divisionId: true, segment: true } } },
    });
    if (!category) throw new Error("Category not found");
    resolved = await ensureCoreCatalogAttributes(
      prisma,
      category.domain.divisionId,
      category.domain.segment,
    );
  }

  await prisma.materialAttributeAssignment.upsert({
    where: {
      categoryId_attributeId: {
        categoryId,
        attributeId: resolved.manufacturerId,
      },
    },
    create: {
      categoryId,
      attributeId: resolved.manufacturerId,
      isRequired: true,
      isFilterable: true,
      isVariantDefining: false,
      sortOrder: 0,
    },
    update: {
      isRequired: true,
      isFilterable: true,
      isVariantDefining: false,
    },
  });

  await prisma.materialAttributeAssignment.upsert({
    where: {
      categoryId_attributeId: {
        categoryId,
        attributeId: resolved.partNumberId,
      },
    },
    create: {
      categoryId,
      attributeId: resolved.partNumberId,
      isRequired: requiresManualPartNumber,
      isFilterable: true,
      isVariantDefining: false,
      sortOrder: 1,
    },
    update: {
      isRequired: requiresManualPartNumber,
      isFilterable: true,
      isVariantDefining: false,
    },
  });
}

/** One-shot / seed: assign core attrs on every category, scope by scope. */
export async function ensureCoreAssignmentsForAllCategories(
  prisma: PrismaClient,
): Promise<EnsureCoreAssignmentsResult> {
  const categories = await prisma.materialCategory.findMany({
    select: {
      id: true,
      requiresManualPartNumber: true,
      domain: { select: { divisionId: true, segment: true } },
    },
  });

  const idsByScope = new Map<string, CoreAttributeIds>();
  for (const cat of categories) {
    const key = `${cat.domain.divisionId}:${cat.domain.segment}`;
    let ids = idsByScope.get(key);
    if (!ids) {
      ids = await ensureCoreCatalogAttributes(
        prisma,
        cat.domain.divisionId,
        cat.domain.segment,
      );
      idsByScope.set(key, ids);
    }
    await ensureCoreAssignmentsForCategory(
      prisma,
      cat.id,
      cat.requiresManualPartNumber,
      ids,
    );
  }

  return {
    scopesUpdated: idsByScope.size,
    categoriesUpdated: categories.length,
  };
}

export { CORE_CATEGORY_ATTRIBUTE_SLUGS };
