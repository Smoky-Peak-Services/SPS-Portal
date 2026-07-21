/**
 * Cent-round money with half-up (Math.round) for engine billable/cost totals.
 * The scaled value is snapped to 12 significant digits first so decimal
 * half-cent cases round up as the sheets expect (e.g. 46.62 × 1.75 = 81.585
 * → 81.59) instead of falling to the binary representation just below .5.
 */
export function roundMoney(n: number): number {
  return Math.round(Number((n * 100).toPrecision(12))) / 100;
}

export type RateColumns = {
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
  actualCostOfLabor: number;
};

export type LaborRateTypeValue = "STANDARD" | "AFTER_HOURS" | "HOLIDAY";

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
    default: {
      const _exhaustive: never = rateType;
      return _exhaustive;
    }
  }
}
