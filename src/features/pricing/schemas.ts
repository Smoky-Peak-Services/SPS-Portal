import { z } from "zod";

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
