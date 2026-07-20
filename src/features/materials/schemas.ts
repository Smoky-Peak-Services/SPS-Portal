import { z } from "zod";

export const segmentSchema = z.enum(["COMMERCIAL", "RESIDENTIAL", "STR"]);
export const taxProfileSchema = z.enum(["REAL_PROPERTY", "TPP"]);
export const inputTypeSchema = z.enum([
  "SELECT",
  "MULTISELECT",
  "TEXT",
  "NUMBER",
  "BOOLEAN",
]);

export const createDomainSchema = z.object({
  divisionId: z.string().min(1),
  segment: segmentSchema,
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateDomainSchema = createDomainSchema.extend({
  id: z.string().min(1),
});

export const createCategorySchema = z.object({
  domainId: z.string().min(1),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  requiresManualPartNumber: z.boolean().optional(),
  taxProfile: taxProfileSchema.optional(),
  stripeTaxCode: z.string().max(64).optional().or(z.literal("")),
});

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().min(1),
});

export const createAttributeSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).optional(),
  inputType: inputTypeSchema,
  unit: z.string().max(40).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updateAttributeSchema = createAttributeSchema.extend({
  id: z.string().min(1),
});

export const createOptionSchema = z.object({
  attributeId: z.string().min(1),
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const updateOptionSchema = createOptionSchema.extend({
  id: z.string().min(1),
});

export const upsertAssignmentSchema = z.object({
  categoryId: z.string().min(1),
  attributeId: z.string().min(1),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isVariantDefining: z.boolean().optional(),
  defaultOptionId: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().optional(),
});

export const deleteAssignmentSchema = z.object({
  id: z.string().min(1),
});

export const attributeValueSchema = z.object({
  attributeId: z.string().min(1),
  optionId: z.string().optional().nullable(),
  valueText: z.string().optional().nullable(),
  valueNumber: z.number().optional().nullable(),
  valueBool: z.boolean().optional().nullable(),
});

export const createItemSchema = z.object({
  categoryId: z.string().min(1),
  unitId: z.string().min(1),
  name: z.string().min(1).max(300),
  laborUnits: z.coerce.number().optional(),
  laborUnitNotes: z.string().max(2000).optional().or(z.literal("")),
  isConsumable: z.boolean().optional(),
  baseCost: z.coerce.number().optional().nullable(),
  markupPct: z.coerce.number().optional().nullable(),
  wasteFactorPct: z.coerce.number().optional().nullable(),
  supplier: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  taxProfile: taxProfileSchema.optional().nullable(),
  stripeTaxCode: z.string().max(64).optional().or(z.literal("")),
  attributeValues: z.array(attributeValueSchema).optional(),
});

export const updateItemSchema = createItemSchema.extend({
  id: z.string().min(1),
});
