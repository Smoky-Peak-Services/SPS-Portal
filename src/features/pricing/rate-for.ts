/**
 * Cent-round money with half-up for engine billable/cost totals and rate cards.
 * Uses Decimal so binary float cannot skew half-cent cases
 * (e.g. 46.62 × 1.75 = 81.585 → 81.59).
 */
import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export function toDecimal(n: number | string | Decimal): Decimal {
  return Decimal.isDecimal(n) ? n : new Decimal(n);
}

/** Round to 2 decimal places (document-level / displayed money). */
export function roundMoneyDecimal(n: number | string | Decimal): Decimal {
  return toDecimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** number boundary for UI / existing tests. */
export function roundMoney(n: number): number {
  return roundMoneyDecimal(n).toNumber();
}

export type RateColumns = {
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
  actualCostOfLabor: number;
  /** Required when rateType is DISCOUNTED (Cabin). */
  discountedRate?: number | null;
};

export type LaborRateTypeValue =
  | "STANDARD"
  | "AFTER_HOURS"
  | "HOLIDAY"
  | "DISCOUNTED";

export function rateFor(
  position: RateColumns,
  rateType: LaborRateTypeValue,
): number {
  switch (rateType) {
    case "STANDARD":
      return position.standardBillingRate;
    case "AFTER_HOURS":
      return position.afterHoursRate;
    case "HOLIDAY":
      return position.holidayRate;
    case "DISCOUNTED": {
      if (position.discountedRate == null) {
        throw new Error(
          "DISCOUNTED rate requested but position has no discountedRate",
        );
      }
      return position.discountedRate;
    }
    default: {
      const _exhaustive: never = rateType;
      return _exhaustive;
    }
  }
}
