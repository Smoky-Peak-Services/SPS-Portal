"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMaterialsAccess } from "@/features/materials/authz";
import {
  assertAttributesWrite,
  assertCatalogWrite,
  assertFinancialsWrite,
  assertTaxReview,
  canWriteCatalog,
  canWriteFinancials,
} from "@/features/materials/authz";
import { isCoreCategoryAttributeSlug } from "./attribute-list-defs";
import { ensureCoreAssignmentsForCategory } from "./ensure-core-assignments";
import { operationalDivisionSlugs, isOperationalDivisionSlug } from "@/config/company";
import { slugify } from "./slug";
import { deriveTaxProfileFromStripeCode } from "./tax";
import { assertItemAttributeValues } from "./validation";
import {
  createAttributeSchema,
  createCategorySchema,
  createDomainSchema,
  createItemSchema,
  createOptionSchema,
  deleteAssignmentSchema,
  markCategoryTaxReviewedSchema,
  updateAttributeSchema,
  updateCategorySchema,
  updateDomainSchema,
  updateItemSchema,
  updateOptionSchema,
  upsertAssignmentSchema,
} from "./schemas";

const MATERIALS_PATHS = [
  "/materials",
  "/materials/domains",
  "/materials/categories",
  "/materials/attributes",
  "/materials/items",
] as const;

function revalidateMaterials() {
  for (const p of MATERIALS_PATHS) revalidatePath(p);
}

function emptyToNull(v: string | null | undefined) {
  const t = v?.trim();
  return t ? t : null;
}

// ---------- Reads ----------

export async function listMaterialCounts() {
  await requireMaterialsAccess();
  const [domains, categories, attributes, items, units] = await Promise.all([
    prisma.materialDomain.count(),
    prisma.materialCategory.count(),
    prisma.materialAttribute.count(),
    prisma.materialItem.count(),
    prisma.materialUnit.count(),
  ]);
  return { domains, categories, attributes, items, units };
}

export async function listDivisionsForMaterials() {
  await requireMaterialsAccess();
  return prisma.division.findMany({
    where: { slug: { in: [...operationalDivisionSlugs()] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, segments: true },
  });
}

export async function listDomains() {
  await requireMaterialsAccess();
  return prisma.materialDomain.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      division: { select: { id: true, name: true, slug: true } },
      _count: { select: { categories: true } },
    },
  });
}

export async function getDomain(id: string) {
  await requireMaterialsAccess();
  return prisma.materialDomain.findUnique({
    where: { id },
    include: { division: true },
  });
}

export async function listCategories(
  domainId?: string,
  opts?: { needsTaxReview?: boolean },
) {
  await requireMaterialsAccess();
  return prisma.materialCategory.findMany({
    where: {
      ...(domainId ? { domainId } : {}),
      ...(opts?.needsTaxReview ? { taxReviewed: false } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      domain: {
        include: { division: { select: { name: true, slug: true } } },
      },
      stripeTaxCode: { select: { id: true, name: true } },
      _count: { select: { items: true, assignments: true } },
    },
  });
}

export async function listStripeTaxCodes() {
  await requireMaterialsAccess();
  return prisma.stripeTaxCode.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
    },
  });
}

export async function getCategory(id: string) {
  await requireMaterialsAccess();
  return prisma.materialCategory.findUnique({
    where: { id },
    include: {
      domain: { include: { division: true } },
      assignments: {
        orderBy: { sortOrder: "asc" },
        include: {
          attribute: {
            include: {
              options: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          defaultOption: true,
        },
      },
    },
  });
}

export async function listAttributes(opts?: { activeOnly?: boolean }) {
  await requireMaterialsAccess();
  return prisma.materialAttribute.findMany({
    where: opts?.activeOnly ? { isActive: true } : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { options: true, assignments: true } },
      options: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getAttribute(id: string) {
  await requireMaterialsAccess();
  return prisma.materialAttribute.findUnique({
    where: { id },
    include: {
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { itemValues: true, defaultFor: true } },
        },
      },
      assignments: {
        include: {
          category: {
            select: { id: true, name: true, domain: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export async function listUnits() {
  await requireMaterialsAccess();
  return prisma.materialUnit.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
}

export async function listItems(categoryId?: string) {
  await requireMaterialsAccess();
  return prisma.materialItem.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: { name: "asc" },
    include: {
      unit: true,
      category: {
        include: {
          domain: {
            include: { division: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export async function getItem(id: string) {
  await requireMaterialsAccess();
  return prisma.materialItem.findUnique({
    where: { id },
    include: {
      unit: true,
      category: {
        include: {
          domain: true,
          assignments: {
            orderBy: { sortOrder: "asc" },
            include: {
              attribute: {
                include: {
                  options: {
                    where: { isActive: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
      values: true,
    },
  });
}

// ---------- Domain writes ----------

async function assertOperationalDivision(divisionId: string) {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { slug: true },
  });
  if (!division || !isOperationalDivisionSlug(division.slug)) {
    throw new Error(
      "Catalog domains must belong to an operational division (not the legal entity)",
    );
  }
}

export async function createDomain(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertCatalogWrite(user);
  const data = createDomainSchema.parse(raw);
  await assertOperationalDivision(data.divisionId);
  const slug = data.slug?.trim() || slugify(data.name);
  const domain = await prisma.materialDomain.create({
    data: {
      divisionId: data.divisionId,
      segment: data.segment,
      name: data.name.trim(),
      slug,
      description: emptyToNull(data.description),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });
  revalidateMaterials();
  return domain;
}

export async function updateDomain(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertCatalogWrite(user);
  const data = updateDomainSchema.parse(raw);
  await assertOperationalDivision(data.divisionId);
  const slug = data.slug?.trim() || slugify(data.name);
  const domain = await prisma.materialDomain.update({
    where: { id: data.id },
    data: {
      divisionId: data.divisionId,
      segment: data.segment,
      name: data.name.trim(),
      slug,
      description: emptyToNull(data.description),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });
  revalidateMaterials();
  return domain;
}

// ---------- Category writes ----------

export async function createCategory(raw: unknown) {
  const user = await requireMaterialsAccess();
  const data = createCategorySchema.parse(raw);
  const writeCatalog = canWriteCatalog(user);
  const writeFin = canWriteFinancials(user);
  if (!writeCatalog && !writeFin) {
    throw new Error("You do not have permission for this action");
  }
  if (writeCatalog) assertCatalogWrite(user);

  const slug = data.slug?.trim() || slugify(data.name);
  const stripeTaxCodeId = writeFin
    ? emptyToNull(data.stripeTaxCodeId)
    : null;
  const taxProfile = deriveTaxProfileFromStripeCode(stripeTaxCodeId);
  const category = await prisma.materialCategory.create({
    data: {
      domainId: data.domainId,
      name: data.name.trim(),
      slug,
      description: emptyToNull(data.description),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      requiresManualPartNumber: data.requiresManualPartNumber ?? false,
      taxProfile,
      ...(writeFin
        ? {
            stripeTaxCodeId,
            laborInstallTaxCodeId: emptyToNull(data.laborInstallTaxCodeId),
            laborServiceTaxCodeId: emptyToNull(data.laborServiceTaxCodeId),
            taxReviewed: data.taxReviewed ?? false,
          }
        : {}),
    },
  });
  await ensureCoreAssignmentsForCategory(
    prisma,
    category.id,
    category.requiresManualPartNumber,
  );
  revalidateMaterials();
  return category;
}

export async function updateCategory(raw: unknown) {
  const user = await requireMaterialsAccess();
  const data = updateCategorySchema.parse(raw);
  const writeCatalog = canWriteCatalog(user);
  const writeFin = canWriteFinancials(user);
  if (!writeCatalog && !writeFin) {
    throw new Error("You do not have permission for this action");
  }

  const slug = data.slug?.trim() || slugify(data.name);
  const stripeTaxCodeId = writeFin
    ? emptyToNull(data.stripeTaxCodeId)
    : undefined;
  const category = await prisma.materialCategory.update({
    where: { id: data.id },
    data: {
      ...(writeCatalog
        ? {
            domainId: data.domainId,
            name: data.name.trim(),
            slug,
            description: emptyToNull(data.description),
            sortOrder: data.sortOrder ?? 0,
            isActive: data.isActive ?? true,
            requiresManualPartNumber: data.requiresManualPartNumber ?? false,
          }
        : {}),
      ...(writeFin
        ? {
            taxProfile: deriveTaxProfileFromStripeCode(stripeTaxCodeId ?? null),
            stripeTaxCodeId: stripeTaxCodeId ?? null,
            laborInstallTaxCodeId: emptyToNull(data.laborInstallTaxCodeId),
            laborServiceTaxCodeId: emptyToNull(data.laborServiceTaxCodeId),
            ...(data.taxReviewed !== undefined
              ? { taxReviewed: data.taxReviewed }
              : {}),
          }
        : {}),
    },
  });
  if (writeCatalog) {
    await ensureCoreAssignmentsForCategory(
      prisma,
      category.id,
      category.requiresManualPartNumber,
    );
  }
  revalidateMaterials();
  return category;
}

export async function markCategoryTaxReviewed(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertTaxReview(user);
  const data = markCategoryTaxReviewedSchema.parse(raw);
  const category = await prisma.materialCategory.update({
    where: { id: data.id },
    data: { taxReviewed: data.taxReviewed },
  });
  revalidateMaterials();
  return category;
}

// ---------- Attribute + options ----------

export async function createAttribute(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertAttributesWrite(user);
  const data = createAttributeSchema.parse(raw);
  const slug = data.slug?.trim() || slugify(data.name);
  const attribute = await prisma.materialAttribute.create({
    data: {
      name: data.name.trim(),
      slug,
      inputType: data.inputType,
      unit: emptyToNull(data.unit),
      isActive: data.isActive ?? true,
    },
  });
  revalidateMaterials();
  return attribute;
}

export async function updateAttribute(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertAttributesWrite(user);
  const data = updateAttributeSchema.parse(raw);
  const slug = data.slug?.trim() || slugify(data.name);
  const attribute = await prisma.materialAttribute.update({
    where: { id: data.id },
    data: {
      name: data.name.trim(),
      slug,
      inputType: data.inputType,
      unit: emptyToNull(data.unit),
      isActive: data.isActive ?? true,
    },
  });
  revalidateMaterials();
  return attribute;
}

export async function createOption(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertAttributesWrite(user);
  const data = createOptionSchema.parse(raw);
  const option = await prisma.materialAttributeOption.create({
    data: {
      attributeId: data.attributeId,
      value: data.value.trim(),
      label: data.label.trim(),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });
  revalidateMaterials();
  return option;
}

export async function updateOption(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertAttributesWrite(user);
  const data = updateOptionSchema.parse(raw);
  const option = await prisma.materialAttributeOption.update({
    where: { id: data.id },
    data: {
      value: data.value.trim(),
      label: data.label.trim(),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });
  revalidateMaterials();
  return option;
}

// ---------- Assignments ----------

export async function upsertAssignment(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertAttributesWrite(user);
  const data = upsertAssignmentSchema.parse(raw);

  const attribute = await prisma.materialAttribute.findUnique({
    where: { id: data.attributeId },
    select: { slug: true },
  });
  if (!attribute) {
    throw new Error("Attribute not found");
  }

  let isRequired = data.isRequired ?? false;
  let isVariantDefining = data.isVariantDefining ?? false;
  if (isCoreCategoryAttributeSlug(attribute.slug)) {
    isVariantDefining = false;
    if (attribute.slug === "manufacturer") {
      isRequired = true;
    } else {
      const category = await prisma.materialCategory.findUnique({
        where: { id: data.categoryId },
        select: { requiresManualPartNumber: true },
      });
      if (!category) {
        throw new Error("Category not found");
      }
      isRequired = category.requiresManualPartNumber;
    }
  }

  const assignment = await prisma.materialAttributeAssignment.upsert({
    where: {
      categoryId_attributeId: {
        categoryId: data.categoryId,
        attributeId: data.attributeId,
      },
    },
    create: {
      categoryId: data.categoryId,
      attributeId: data.attributeId,
      isRequired,
      isFilterable: data.isFilterable ?? true,
      isVariantDefining,
      defaultOptionId: emptyToNull(data.defaultOptionId),
      sortOrder: data.sortOrder ?? 0,
    },
    update: {
      isRequired,
      isFilterable: data.isFilterable ?? true,
      isVariantDefining,
      defaultOptionId: emptyToNull(data.defaultOptionId),
      sortOrder: data.sortOrder ?? 0,
    },
  });
  revalidateMaterials();
  return assignment;
}

export async function deleteAssignment(raw: unknown) {
  const user = await requireMaterialsAccess();
  assertAttributesWrite(user);
  const data = deleteAssignmentSchema.parse(raw);
  const existing = await prisma.materialAttributeAssignment.findUnique({
    where: { id: data.id },
    include: { attribute: { select: { slug: true, name: true } } },
  });
  if (!existing) {
    throw new Error("Assignment not found");
  }
  if (isCoreCategoryAttributeSlug(existing.attribute.slug)) {
    throw new Error(
      `${existing.attribute.name} is required on every category and cannot be unassigned`,
    );
  }
  await prisma.materialAttributeAssignment.delete({ where: { id: data.id } });
  revalidateMaterials();
}

// ---------- Items ----------

async function loadAssignmentsForCategory(categoryId: string) {
  return prisma.materialAttributeAssignment.findMany({
    where: { categoryId },
    include: {
      attribute: {
        include: {
          options: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

async function writeItemValues(
  itemId: string,
  categoryId: string,
  values: {
    attributeId: string;
    optionId?: string | null;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBool?: boolean | null;
  }[],
) {
  const assignments = await loadAssignmentsForCategory(categoryId);
  assertItemAttributeValues({ assignments, values });

  await prisma.materialItemAttributeValue.deleteMany({ where: { itemId } });
  if (values.length === 0) return;

  await prisma.materialItemAttributeValue.createMany({
    data: values.map((v) => ({
      itemId,
      attributeId: v.attributeId,
      optionId: v.optionId || null,
      valueText: v.valueText ?? null,
      valueNumber: v.valueNumber ?? null,
      valueBool: v.valueBool ?? null,
    })),
  });
}

export async function createItem(raw: unknown) {
  const user = await requireMaterialsAccess();
  const data = createItemSchema.parse(raw);
  const writeCatalog = canWriteCatalog(user);
  const writeFin = canWriteFinancials(user);
  if (!writeCatalog && !writeFin) {
    throw new Error("You do not have permission for this action");
  }
  if (writeCatalog) assertCatalogWrite(user);
  else assertFinancialsWrite(user);

  const values = writeCatalog ? (data.attributeValues ?? []) : [];

  const item = await prisma.materialItem.create({
    data: {
      categoryId: data.categoryId,
      unitId: data.unitId,
      name: data.name.trim(),
      laborUnits: data.laborUnits ?? 0,
      laborUnitNotes: emptyToNull(data.laborUnitNotes),
      isConsumable: data.isConsumable ?? false,
      supplier: emptyToNull(data.supplier),
      notes: emptyToNull(data.notes),
      isActive: data.isActive ?? true,
      ...(writeFin
        ? {
            baseCost: data.isConsumable ? (data.baseCost ?? null) : null,
            markupPct: data.isConsumable ? (data.markupPct ?? null) : null,
            wasteFactorPct: data.isConsumable
              ? (data.wasteFactorPct ?? null)
              : null,
            taxProfile: null,
            stripeTaxCodeId: emptyToNull(data.stripeTaxCodeId),
            laborInstallTaxCodeId: emptyToNull(data.laborInstallTaxCodeId),
            laborServiceTaxCodeId: emptyToNull(data.laborServiceTaxCodeId),
          }
        : {}),
    },
  });

  if (writeCatalog) {
    await writeItemValues(item.id, data.categoryId, values);
  }
  revalidateMaterials();
  return item;
}

export async function updateItem(raw: unknown) {
  const user = await requireMaterialsAccess();
  const data = updateItemSchema.parse(raw);
  const writeCatalog = canWriteCatalog(user);
  const writeFin = canWriteFinancials(user);
  if (!writeCatalog && !writeFin) {
    throw new Error("You do not have permission for this action");
  }

  const values = data.attributeValues ?? [];

  const item = await prisma.materialItem.update({
    where: { id: data.id },
    data: {
      ...(writeCatalog
        ? {
            categoryId: data.categoryId,
            unitId: data.unitId,
            name: data.name.trim(),
            laborUnits: data.laborUnits ?? 0,
            laborUnitNotes: emptyToNull(data.laborUnitNotes),
            isConsumable: data.isConsumable ?? false,
            supplier: emptyToNull(data.supplier),
            notes: emptyToNull(data.notes),
            isActive: data.isActive ?? true,
          }
        : {}),
      ...(writeFin
        ? {
            baseCost: data.isConsumable ? (data.baseCost ?? null) : null,
            markupPct: data.isConsumable ? (data.markupPct ?? null) : null,
            wasteFactorPct: data.isConsumable
              ? (data.wasteFactorPct ?? null)
              : null,
            taxProfile: null,
            stripeTaxCodeId: emptyToNull(data.stripeTaxCodeId),
            laborInstallTaxCodeId: emptyToNull(data.laborInstallTaxCodeId),
            laborServiceTaxCodeId: emptyToNull(data.laborServiceTaxCodeId),
          }
        : {}),
    },
  });

  if (writeCatalog) {
    await writeItemValues(item.id, data.categoryId, values);
  }
  revalidateMaterials();
  return item;
}
