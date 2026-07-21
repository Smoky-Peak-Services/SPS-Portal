import type { PrismaClient } from "@prisma/client";
import { CORE_CATEGORY_ATTRIBUTE_SLUGS } from "./attribute-list-defs";

export type EnsureCoreAssignmentsResult = {
  manufacturerId: string;
  partNumberId: string;
  categoriesUpdated: number;
};

/**
 * Ensure manufacturer (SELECT, always required) and part_number (TEXT,
 * required iff category.requiresManualPartNumber) exist and are assigned
 * on the given category — or on every category when categoryId is omitted.
 */
export async function ensureCoreCatalogAttributes(
  prisma: PrismaClient,
): Promise<{ manufacturerId: string; partNumberId: string }> {
  const manufacturer = await prisma.materialAttribute.upsert({
    where: { slug: "manufacturer" },
    create: {
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
    where: { slug: "part_number" },
    create: {
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
  ids?: { manufacturerId: string; partNumberId: string },
): Promise<void> {
  const resolved = ids ?? (await ensureCoreCatalogAttributes(prisma));

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

/** One-shot / seed: assign core attrs on every category. */
export async function ensureCoreAssignmentsForAllCategories(
  prisma: PrismaClient,
): Promise<EnsureCoreAssignmentsResult> {
  const ids = await ensureCoreCatalogAttributes(prisma);
  const categories = await prisma.materialCategory.findMany({
    select: { id: true, requiresManualPartNumber: true },
  });

  for (const cat of categories) {
    await ensureCoreAssignmentsForCategory(
      prisma,
      cat.id,
      cat.requiresManualPartNumber,
      ids,
    );
  }

  return {
    ...ids,
    categoriesUpdated: categories.length,
  };
}

export { CORE_CATEGORY_ATTRIBUTE_SLUGS };
