/**
 * Derivation helper for labor rates (prompt 09).
 * Stored LaborPosition columns are authoritative at runtime;
 * this reproduces sheet math from base × config multipliers.
 *
 * Intermediate standard billing is kept unrounded when deriving after-hours /
 * holiday so Excel-style chain matches the sheet (e.g. Tech1 holiday 110.14).
 */
import { roundMoney } from "./rate-for";

export type LaborRateMultipliers = {
  burdenMultiplier: number;
  commercialBillingMultiplier: number;
  afterHoursMultiplier: number;
  holidayMultiplier: number;
};

export type RecomputedRates = {
  actualCostOfLabor: number;
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
};

/**
 * actualCost = round(base × burden)
 * standardRaw = cost × commercialBilling (unrounded)
 * standard = round(standardRaw)
 * afterHours / holiday = round(standardRaw × respective multipliers)
 */
export function recomputeRates(
  config: LaborRateMultipliers,
  baseHourlyRate: number,
): RecomputedRates {
  const actualCostOfLabor = roundMoney(
    baseHourlyRate * config.burdenMultiplier,
  );
  const standardRaw =
    actualCostOfLabor * config.commercialBillingMultiplier;
  const standardBillingRate = roundMoney(standardRaw);
  const afterHoursRate = roundMoney(
    standardRaw * config.afterHoursMultiplier,
  );
  const holidayRate = roundMoney(standardRaw * config.holidayMultiplier);
  return {
    actualCostOfLabor,
    standardBillingRate,
    afterHoursRate,
    holidayRate,
  };
}
