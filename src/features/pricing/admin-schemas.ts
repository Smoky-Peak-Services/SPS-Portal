import { z } from "zod";

export const updateLaborRateConfigSchema = z.object({
  id: z.string().min(1),
  burdenMultiplier: z.coerce.number().positive(),
  commercialBillingMultiplier: z.coerce.number().positive(),
  afterHoursMultiplier: z.coerce.number().positive(),
  holidayMultiplier: z.coerce.number().positive(),
});

export const updateLaborPositionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  baseHourlyRate: z.coerce.number().nonnegative(),
  actualCostOfLabor: z.coerce.number().nonnegative(),
  standardBillingRate: z.coerce.number().nonnegative(),
  afterHoursRate: z.coerce.number().nonnegative(),
  holidayRate: z.coerce.number().nonnegative(),
  quotedAllocationPct: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int(),
});

export const updateComplexityMultiplierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  category: z.enum(["STRUCTURAL", "ACCESS", "COMPLIANCE"]),
  modificationRate: z.coerce.number().min(0).max(1),
  description: z.string().min(1),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

const optionalNullableMoney = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return v;
}, z.union([z.null(), z.coerce.number().nonnegative()]).optional());

export const updateRecurringFeeItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(240),
  baseCost: z.coerce.number().nonnegative(),
  directPurchaseRate: z.coerce.number().nonnegative(),
  smaBundledRate: z.coerce.number().nonnegative(),
  notes: z.string().min(1),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
  systemValueMin: optionalNullableMoney,
  systemValueMax: optionalNullableMoney,
});
