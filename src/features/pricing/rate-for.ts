/** Cent-round money with half-up (Math.round) for engine billable/cost totals. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
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
