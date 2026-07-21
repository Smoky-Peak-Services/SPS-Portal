/**
 * The one definition of the labor rate chain (prompts 09 + 16).
 *
 * Base + the scope's LaborRateConfig multipliers are the source of truth;
 * the stored Cost/Std/AH/Holiday/Discounted columns on LaborPosition are a
 * materialized cache regenerated through this function on every base or
 * multiplier save — never hand-edited, never defined anywhere else.
 *
 * Base is a manual per-position average today; later it becomes the computed
 * average of employee pay rates for the role (same input slot, new source).
 *
 * Intermediate standard billing is kept unrounded when deriving after-hours /
 * holiday / discounted so the Excel-style chain matches the sheets
 * (e.g. IS-COM Tech1 holiday 110.14).
 */
import { roundMoney } from "./rate-for";

export type LaborRateMultipliers = {
  burdenMultiplier: number;
  standardBillingMultiplier: number;
  afterHoursMultiplier: number;
  holidayMultiplier: number;
  /** Cabin only (0.90) — omit/null for scopes without a discounted rate. */
  discountedMultiplier?: number | null;
};

export type RecomputedRates = {
  actualCostOfLabor: number;
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
  /** null when the scope has no discountedMultiplier. */
  discountedRate: number | null;
};

/**
 * actualCost = round(base × burden)
 * standardRaw = cost × standardBilling (unrounded)
 * standard = round(standardRaw)
 * afterHours / holiday / discounted = round(standardRaw × respective multipliers)
 */
export function recomputeRates(
  config: LaborRateMultipliers,
  baseHourlyRate: number,
): RecomputedRates {
  const actualCostOfLabor = roundMoney(
    baseHourlyRate * config.burdenMultiplier,
  );
  const standardRaw = actualCostOfLabor * config.standardBillingMultiplier;
  const standardBillingRate = roundMoney(standardRaw);
  const afterHoursRate = roundMoney(standardRaw * config.afterHoursMultiplier);
  const holidayRate = roundMoney(standardRaw * config.holidayMultiplier);
  const discountedRate =
    config.discountedMultiplier != null
      ? roundMoney(standardRaw * config.discountedMultiplier)
      : null;
  return {
    actualCostOfLabor,
    standardBillingRate,
    afterHoursRate,
    holidayRate,
    discountedRate,
  };
}
