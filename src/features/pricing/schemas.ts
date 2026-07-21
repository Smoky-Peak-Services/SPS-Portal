import { z } from "zod";
import { selectSmaBaseTier } from "./sma-tier";

export const laborRateTypeSchema = z.enum([
  "STANDARD",
  "AFTER_HOURS",
  "HOLIDAY",
]);

export type LaborRateTypeInput = z.infer<typeof laborRateTypeSchema>;

/** Position shape accepted by quoted-labor Zod + engine. */
export const quotedLaborPositionSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  context: z.enum(["INSTALL", "SERVICE"]),
  quotedAllocationPct: z.number(),
  standardBillingRate: z.number(),
  afterHoursRate: z.number(),
  holidayRate: z.number(),
  actualCostOfLabor: z.number(),
});

export type QuotedLaborPositionInput = z.infer<typeof quotedLaborPositionSchema>;

const ALLOCATION_TOLERANCE = 0.001;

/**
 * INSTALL positions only; allocation must sum to exactly 100% (±0.001).
 * Rejects SERVICE-context roles (e.g. LAB-COM-SVC-SIS) — fail loudly, never drop.
 */
export const quotedAllocationSchema = z
  .array(quotedLaborPositionSchema)
  .min(1)
  .superRefine((positions, ctx) => {
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!;
      if (p.context === "SERVICE" || p.sku === "LAB-COM-SVC-SIS") {
        ctx.addIssue({
          code: "custom",
          message: `Service position "${p.sku}" cannot appear in quoted labor distribution`,
          path: [i, "sku"],
        });
      }
    }
    const sum = positions.reduce((n, p) => n + p.quotedAllocationPct, 0);
    if (Math.abs(sum - 100) >= ALLOCATION_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        message: `INSTALL quotedAllocationPct must sum to 100 (got ${sum})`,
      });
    }
  });

export const distributeQuotedLaborInputSchema = z.object({
  totalHours: z.number().finite().nonnegative(),
  positions: quotedAllocationSchema,
  rateType: laborRateTypeSchema,
});

export const serviceLaborPositionSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  context: z.literal("SERVICE"),
  standardBillingRate: z.number(),
  afterHoursRate: z.number(),
  holidayRate: z.number(),
  actualCostOfLabor: z.number(),
});

export const calculateServiceTicketLaborInputSchema = z.object({
  hoursLogged: z.number().finite().nonnegative(),
  position: serviceLaborPositionSchema,
  rateType: laborRateTypeSchema,
});

// ---------- Recurring fees / SMA (prompt 11) ----------

export const smaPurchaseTypeSchema = z.enum(["DIRECT", "SMA_BUNDLED"]);
export type SmaPurchaseType = z.infer<typeof smaPurchaseTypeSchema>;

export const recurringFeeTypeSchema = z.enum([
  "SMA_BASE_TIER",
  "SMA_SVM",
  "SMA_BANK_OF_HOURS",
  "MONTHLY_SERVICE",
]);

export const billingCycleSchema = z.enum(["ANNUAL", "MONTHLY"]);

const SMA_FEE_TYPES = new Set([
  "SMA_BASE_TIER",
  "SMA_SVM",
  "SMA_BANK_OF_HOURS",
]);

/** feeType ↔ billingCycle: SMA* → ANNUAL, MONTHLY_SERVICE → MONTHLY. */
export function refineFeeTypeBillingCycle(
  feeType: z.infer<typeof recurringFeeTypeSchema>,
  billingCycle: z.infer<typeof billingCycleSchema>,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[] = [],
) {
  if (SMA_FEE_TYPES.has(feeType) && billingCycle !== "ANNUAL") {
    ctx.addIssue({
      code: "custom",
      message: `SMA feeType ${feeType} requires billingCycle ANNUAL (got ${billingCycle})`,
      path: [...pathPrefix, "billingCycle"],
    });
  }
  if (feeType === "MONTHLY_SERVICE" && billingCycle !== "MONTHLY") {
    ctx.addIssue({
      code: "custom",
      message: `MONTHLY_SERVICE requires billingCycle MONTHLY (got ${billingCycle})`,
      path: [...pathPrefix, "billingCycle"],
    });
  }
}

export const smaBaseTierSchema = z
  .object({
    sku: z.string().min(1),
    feeType: z.literal("SMA_BASE_TIER"),
    billingCycle: z.literal("ANNUAL"),
    valueType: z.literal("CURRENCY"),
    directPurchaseRate: z.number().finite().nonnegative(),
    smaBundledRate: z.number().finite().nonnegative(),
    systemValueMin: z.number().finite().nullable(),
    systemValueMax: z.number().finite().nullable(),
  })
  .superRefine((row, ctx) => {
    refineFeeTypeBillingCycle(row.feeType, row.billingCycle, ctx);
  });

export type SmaBaseTierInput = z.infer<typeof smaBaseTierSchema>;

export const smaSvmSchema = z
  .object({
    sku: z.string().min(1),
    feeType: z.literal("SMA_SVM"),
    billingCycle: z.literal("ANNUAL"),
    valueType: z.literal("PERCENT"),
    directPurchaseRate: z.number().finite().nonnegative(),
    smaBundledRate: z.number().finite().nonnegative(),
  })
  .superRefine((row, ctx) => {
    refineFeeTypeBillingCycle(row.feeType, row.billingCycle, ctx);
  });

export type SmaSvmInput = z.infer<typeof smaSvmSchema>;

/**
 * Monthly service item — structurally no SVM field.
 * feeType is literal MONTHLY_SERVICE so SMA rows cannot be passed.
 */
export const monthlyServiceItemSchema = z
  .object({
    sku: z.string().min(1),
    feeType: z.literal("MONTHLY_SERVICE"),
    billingCycle: z.literal("MONTHLY"),
    valueType: z.literal("CURRENCY"),
    directPurchaseRate: z.number().finite().nonnegative(),
    smaBundledRate: z.number().finite().nonnegative(),
  })
  .superRefine((row, ctx) => {
    refineFeeTypeBillingCycle(row.feeType, row.billingCycle, ctx);
  });

export type MonthlyServiceItemInput = z.infer<typeof monthlyServiceItemSchema>;

export const calculateAnnualSmaPriceInputSchema = z
  .object({
    systemMaterialValue: z.number().finite().nonnegative(),
    purchaseType: smaPurchaseTypeSchema,
    bankOfHoursQty: z.number().finite().nonnegative(),
    tiers: z.array(smaBaseTierSchema).min(1),
    svm: smaSvmSchema,
    tech12StandardRate: z.number().finite().positive(),
  })
  .superRefine((input, ctx) => {
    const tier = selectSmaBaseTier(input.systemMaterialValue, input.tiers);
    if (!tier) {
      ctx.addIssue({
        code: "custom",
        message: `No SMA base tier for system material value ${input.systemMaterialValue} (minimum $500)`,
        path: ["systemMaterialValue"],
      });
    }
  });

export const resolveMonthlyServiceRateInputSchema = z.object({
  item: monthlyServiceItemSchema,
  customerHasActiveSma: z.boolean(),
});
