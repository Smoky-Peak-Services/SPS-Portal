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
