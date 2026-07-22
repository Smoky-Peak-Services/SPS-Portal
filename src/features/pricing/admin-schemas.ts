import { z } from "zod";
import {
  billingCycleSchema,
  refineFeeTypeBillingCycle,
  recurringFeeTypeSchema,
} from "./schemas";

const optionalNullablePositive = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  },
  z.union([z.null(), z.coerce.number().positive()]).optional(),
);

export const updateLaborRateConfigSchema = z.object({
  id: z.string().min(1),
  burdenMultiplier: z.coerce.number().positive(),
  standardBillingMultiplier: z.coerce.number().positive(),
  afterHoursMultiplier: z.coerce.number().positive(),
  holidayMultiplier: z.coerce.number().positive(),
  discountedMultiplier: optionalNullablePositive,
});

/**
 * Base is the only editable money input (prompt 16) — Cost/Std/AH/Holiday/
 * Discounted are derived via recomputeRates on save and cannot be submitted.
 */
export const updateLaborPositionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  baseHourlyRate: z.coerce.number().nonnegative(),
  quotedAllocationPct: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int(),
});

export const updateComplexityMultiplierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(80),
  multiplierType: z.enum(["PERCENT", "FIXED"]),
  appliedTo: z.enum([
    "TOTAL_LABOR",
    "PROGRAMMING_LABOR",
    "NETWORK_LABOR",
    "BASE_PACKAGE_RATE",
  ]),
  value: z.coerce.number().nonnegative(),
  description: z.string().min(1),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

const optionalNullableMoney = z.preprocess(
  (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return v;
  },
  z.union([z.null(), z.coerce.number().nonnegative()]).optional(),
);

export const updateServicePlanRateSchema = z.object({
  id: z.string().min(1),
  rate: optionalNullableMoney,
  isActive: z.coerce.boolean(),
});

const rateValueTypeSchema = z.enum(["CURRENCY", "PERCENT"]);

const recurringFeeFieldsSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU must be alphanumeric (._- allowed)"),
  description: z.string().trim().min(1).max(240),
  baseCost: z.coerce.number().nonnegative(),
  directPurchaseRate: z.coerce.number().nonnegative(),
  smaBundledRate: z.coerce.number().nonnegative(),
  billingCycle: billingCycleSchema,
  feeType: recurringFeeTypeSchema,
  valueType: rateValueTypeSchema,
  notes: z.string().trim().min(1),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
  systemValueMin: optionalNullableMoney,
  systemValueMax: optionalNullableMoney,
});

function withFeeTypeBillingCycleRefine<
  T extends z.ZodType<z.infer<typeof recurringFeeFieldsSchema>>,
>(schema: T) {
  return schema.superRefine((row, ctx) => {
    refineFeeTypeBillingCycle(row.feeType, row.billingCycle, ctx);
    if (row.feeType === "SMA_BASE_TIER" && row.valueType !== "CURRENCY") {
      ctx.addIssue({
        code: "custom",
        message: "SMA base tiers must use CURRENCY value type",
        path: ["valueType"],
      });
    }
    if (row.feeType === "SMA_SVM" && row.valueType !== "PERCENT") {
      ctx.addIssue({
        code: "custom",
        message: "SMA SVM rows must use PERCENT value type",
        path: ["valueType"],
      });
    }
  });
}

/** Create a fee row in the active scope (IS-COM, IS-RES, or any non-Cabin sheet). */
export const createRecurringFeeItemSchema = withFeeTypeBillingCycleRefine(
  recurringFeeFieldsSchema.extend({
    divisionId: z.string().min(1),
    segment: z.enum(["COMMERCIAL", "RESIDENTIAL", "STR"]),
  }),
);

/** Full update — structural fields editable so scopes can be built from the UI. */
export const updateRecurringFeeItemSchema = withFeeTypeBillingCycleRefine(
  recurringFeeFieldsSchema.extend({
    id: z.string().min(1),
  }),
);

export const deleteRecurringFeeItemSchema = z.object({
  id: z.string().min(1),
});

/** Unit follows billing cycle (YEAR ↔ ANNUAL, MONTH ↔ MONTHLY). */
export function unitForBillingCycle(
  billingCycle: z.infer<typeof billingCycleSchema>,
): "YEAR" | "MONTH" {
  return billingCycle === "ANNUAL" ? "YEAR" : "MONTH";
}
