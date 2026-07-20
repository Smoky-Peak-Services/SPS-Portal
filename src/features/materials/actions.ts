"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/session";
import { slugify } from "./slug";
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
  await requireArea("materials");
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
  await requireArea("materials");
  return prisma.division.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, segments: true },
  });
}

export async function listDomains() {
  await requireArea("materials");
  return prisma.materialDomain.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      division: { select: { id: true, name: true, slug: true } },
      _count: { select: { categories: true } },
    },
  });
}

export async function getDomain(id: string) {
  await requireArea("materials");
  return prisma.materialDomain.findUnique({
    where: { id },
    include: { division: true },
  });
}

export async function listCategories(
  domainId?: string,
  opts?: { needsTaxReview?: boolean },
) {
  await requireArea("materials");
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
  await requireArea("materials");
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
  await requireArea("materials");
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

export async function listAttributes() {
  await requireArea("materials");
  return prisma.materialAttribute.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { options: true, assignments: true } },
      options: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getAttribute(id: string) {
  await requireArea("materials");
  return prisma.materialAttribute.findUnique({
    where: { id },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
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
  await requireArea("materials");
  return prisma.materialUnit.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
}

export async function listItems(categoryId?: string) {
  await requireArea("materials");
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
  await requireArea("materials");
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

export async function createDomain(raw: unknown) {
  await requireArea("materials");
  const data = createDomainSchema.parse(raw);
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
  await requireArea("materials");
  const data = updateDomainSchema.parse(raw);
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
  await requireArea("materials");
  const data = createCategorySchema.parse(raw);
  const slug = data.slug?.trim() || slugify(data.name);
  const category = await prisma.materialCategory.create({
    data: {
      domainId: data.domainId,
      name: data.name.trim(),
      slug,
      description: emptyToNull(data.description),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      requiresManualPartNumber: data.requiresManualPartNumber ?? false,
      taxProfile: data.taxProfile ?? "REAL_PROPERTY",
      stripeTaxCodeId: emptyToNull(data.stripeTaxCodeId),
      taxReviewed: data.taxReviewed ?? false,
    },
  });
  revalidateMaterials();
  return category;
}

export async function updateCategory(raw: unknown) {
  await requireArea("materials");
  const data = updateCategorySchema.parse(raw);
  const slug = data.slug?.trim() || slugify(data.name);
  const category = await prisma.materialCategory.update({
    where: { id: data.id },
    data: {
      domainId: data.domainId,
      name: data.name.trim(),
      slug,
      description: emptyToNull(data.description),
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      requiresManualPartNumber: data.requiresManualPartNumber ?? false,
      taxProfile: data.taxProfile ?? "REAL_PROPERTY",
      stripeTaxCodeId: emptyToNull(data.stripeTaxCodeId),
      ...(data.taxReviewed !== undefined
        ? { taxReviewed: data.taxReviewed }
        : {}),
    },
  });
  revalidateMaterials();
  return category;
}

export async function markCategoryTaxReviewed(raw: unknown) {
  await requireArea("materials");
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
  await requireArea("materials");
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
  await requireArea("materials");
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
  await requireArea("materials");
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
  await requireArea("materials");
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
  await requireArea("materials");
  const data = upsertAssignmentSchema.parse(raw);
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
      isRequired: data.isRequired ?? false,
      isFilterable: data.isFilterable ?? true,
      isVariantDefining: data.isVariantDefining ?? false,
      defaultOptionId: emptyToNull(data.defaultOptionId),
      sortOrder: data.sortOrder ?? 0,
    },
    update: {
      isRequired: data.isRequired ?? false,
      isFilterable: data.isFilterable ?? true,
      isVariantDefining: data.isVariantDefining ?? false,
      defaultOptionId: emptyToNull(data.defaultOptionId),
      sortOrder: data.sortOrder ?? 0,
    },
  });
  revalidateMaterials();
  return assignment;
}

export async function deleteAssignment(raw: unknown) {
  await requireArea("materials");
  const data = deleteAssignmentSchema.parse(raw);
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
  await requireArea("materials");
  const data = createItemSchema.parse(raw);
  const values = data.attributeValues ?? [];

  const item = await prisma.materialItem.create({
    data: {
      categoryId: data.categoryId,
      unitId: data.unitId,
      name: data.name.trim(),
      laborUnits: data.laborUnits ?? 0,
      laborUnitNotes: emptyToNull(data.laborUnitNotes),
      isConsumable: data.isConsumable ?? false,
      baseCost: data.isConsumable ? (data.baseCost ?? null) : null,
      markupPct: data.isConsumable ? (data.markupPct ?? null) : null,
      wasteFactorPct: data.isConsumable ? (data.wasteFactorPct ?? null) : null,
      supplier: emptyToNull(data.supplier),
      notes: emptyToNull(data.notes),
      isActive: data.isActive ?? true,
      taxProfile: data.taxProfile ?? null,
      stripeTaxCodeId: emptyToNull(data.stripeTaxCodeId),
    },
  });

  await writeItemValues(item.id, data.categoryId, values);
  revalidateMaterials();
  return item;
}

export async function updateItem(raw: unknown) {
  await requireArea("materials");
  const data = updateItemSchema.parse(raw);
  const values = data.attributeValues ?? [];

  const item = await prisma.materialItem.update({
    where: { id: data.id },
    data: {
      categoryId: data.categoryId,
      unitId: data.unitId,
      name: data.name.trim(),
      laborUnits: data.laborUnits ?? 0,
      laborUnitNotes: emptyToNull(data.laborUnitNotes),
      isConsumable: data.isConsumable ?? false,
      baseCost: data.isConsumable ? (data.baseCost ?? null) : null,
      markupPct: data.isConsumable ? (data.markupPct ?? null) : null,
      wasteFactorPct: data.isConsumable ? (data.wasteFactorPct ?? null) : null,
      supplier: emptyToNull(data.supplier),
      notes: emptyToNull(data.notes),
      isActive: data.isActive ?? true,
      taxProfile: data.taxProfile ?? null,
      stripeTaxCodeId: emptyToNull(data.stripeTaxCodeId),
    },
  });

  await writeItemValues(item.id, data.categoryId, values);
  revalidateMaterials();
  return item;
}
