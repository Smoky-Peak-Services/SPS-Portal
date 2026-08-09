/**
 * The one definition of the labor rate chain (prompts 09 + 16).
 *
 * Base + the scope's LaborRateConfig multipliers are the source of truth;
 * the stored Cost/Std/AH/Holiday/Discounted columns on LaborPosition are a
 * materialized cache regenerated through this function on every base or
 * multiplier save — never hand-edited, never defined anywhere else.
 *
 * Intermediate standard billing is kept unrounded when deriving after-hours /
 * holiday / discounted so the Excel-style chain matches the sheets
 * (e.g. IS-COM Tech1 holiday 110.14).
 */
import { Prisma } from "@prisma/client";
import { roundMoneyDecimal, toDecimal } from "./rate-for";

type Decimal = Prisma.Decimal;

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
  const base = toDecimal(baseHourlyRate);
  const actualCostOfLabor = roundMoneyDecimal(
    base.mul(config.burdenMultiplier),
  );
  const standardRaw = actualCostOfLabor.mul(config.standardBillingMultiplier);
  const standardBillingRate = roundMoneyDecimal(standardRaw);
  const afterHoursRate = roundMoneyDecimal(
    standardRaw.mul(config.afterHoursMultiplier),
  );
  const holidayRate = roundMoneyDecimal(
    standardRaw.mul(config.holidayMultiplier),
  );
  const discountedRate =
    config.discountedMultiplier != null
      ? roundMoneyDecimal(
          standardRaw.mul(config.discountedMultiplier),
        ).toNumber()
      : null;
  return {
    actualCostOfLabor: actualCostOfLabor.toNumber(),
    standardBillingRate: standardBillingRate.toNumber(),
    afterHoursRate: afterHoursRate.toNumber(),
    holidayRate: holidayRate.toNumber(),
    discountedRate,
  };
}

/** Decimal variant for callers that already hold Decimal inputs. */
export function recomputeRatesDecimal(
  config: {
    burdenMultiplier: Decimal;
    standardBillingMultiplier: Decimal;
    afterHoursMultiplier: Decimal;
    holidayMultiplier: Decimal;
    discountedMultiplier: Decimal | null;
  },
  baseHourlyRate: Decimal,
): {
  actualCostOfLabor: Decimal;
  standardBillingRate: Decimal;
  afterHoursRate: Decimal;
  holidayRate: Decimal;
  discountedRate: Decimal | null;
} {
  const actualCostOfLabor = roundMoneyDecimal(
    baseHourlyRate.mul(config.burdenMultiplier),
  );
  const standardRaw = actualCostOfLabor.mul(config.standardBillingMultiplier);
  return {
    actualCostOfLabor,
    standardBillingRate: roundMoneyDecimal(standardRaw),
    afterHoursRate: roundMoneyDecimal(standardRaw.mul(config.afterHoursMultiplier)),
    holidayRate: roundMoneyDecimal(standardRaw.mul(config.holidayMultiplier)),
    discountedRate:
      config.discountedMultiplier == null
        ? null
        : roundMoneyDecimal(standardRaw.mul(config.discountedMultiplier)),
  };
}
