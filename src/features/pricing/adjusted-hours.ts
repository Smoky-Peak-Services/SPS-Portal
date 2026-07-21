/**
 * Complexity hours adjuster (prompt 10, generalized in prompt 14).
 *
 * STRICT RULE: this engine ONLY ever touches labor hours. Never multiply a
 * labor dollar amount, billable total, cost basis, or project price here.
 * Dollar-based BASE_PACKAGE_RATE rows belong to calculateAdjustedPackageRate
 * (package-rate.ts) and are rejected, as are FIXED rows.
 *
 * PERCENT multipliers add hours against their appliedTo bucket:
 * TOTAL_LABOR uses totalHours; PROGRAMMING_LABOR / NETWORK_LABOR use the
 * itemized bucket when provided, otherwise fall back to totalHours.
 *
 * Additive (not compounded): each rate is applied independently against its
 * bucket, then the additions are summed. No cap.
 *
 * After Hours Required Installation (0.20) may intentionally stack with
 * LaborRateType.AFTER_HOURS (higher $/hr) — deliberate per the sheet note;
 * do not auto-block the combination.
 *
 * totalHours from this function is what later quoting passes into
 * distributeQuotedLabor (prompt 09) — no quote entity wiring here yet.
 */
import { roundMoney } from "./rate-for";

export type ComplexityHoursInput = {
  totalHours: number;
  programmingHours?: number;
  networkHours?: number;
};

export type ActiveComplexityMultiplier = {
  name: string;
  slug?: string;
  multiplierType: "PERCENT" | "FIXED";
  appliedTo:
    "TOTAL_LABOR" | "PROGRAMMING_LABOR" | "NETWORK_LABOR" | "BASE_PACKAGE_RATE";
  value: number;
};

export type ComplexityHoursBreakdown = {
  name: string;
  slug?: string;
  appliedTo: "TOTAL_LABOR" | "PROGRAMMING_LABOR" | "NETWORK_LABOR";
  rate: number;
  baseHours: number;
  additionalHours: number;
};

export type AdjustedLaborHoursResult = {
  baseHours: number;
  perMultiplier: ComplexityHoursBreakdown[];
  additionalHours: number;
  totalHours: number;
};

function assertFiniteNonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
}

export function calculateAdjustedLaborHours(
  hours: ComplexityHoursInput,
  activeMultipliers: ActiveComplexityMultiplier[],
): AdjustedLaborHoursResult {
  assertFiniteNonnegative(hours.totalHours, "totalHours");
  if (hours.programmingHours !== undefined) {
    assertFiniteNonnegative(hours.programmingHours, "programmingHours");
  }
  if (hours.networkHours !== undefined) {
    assertFiniteNonnegative(hours.networkHours, "networkHours");
  }

  const perMultiplier: ComplexityHoursBreakdown[] = [];
  let additionalHours = 0;

  for (const m of activeMultipliers) {
    if (m.multiplierType !== "PERCENT") {
      throw new Error(
        `Multiplier "${m.name}" is ${m.multiplierType} — only PERCENT rows adjust labor hours`,
      );
    }
    if (m.appliedTo === "BASE_PACKAGE_RATE") {
      throw new Error(
        `Multiplier "${m.name}" applies to BASE_PACKAGE_RATE — use calculateAdjustedPackageRate, not the hours engine`,
      );
    }
    if (!Number.isFinite(m.value) || m.value < 0) {
      throw new Error(
        `value for "${m.name}" must be a finite non-negative decimal`,
      );
    }

    const bucketHours =
      m.appliedTo === "PROGRAMMING_LABOR"
        ? (hours.programmingHours ?? hours.totalHours)
        : m.appliedTo === "NETWORK_LABOR"
          ? (hours.networkHours ?? hours.totalHours)
          : hours.totalHours;

    const add = roundMoney(bucketHours * m.value);
    perMultiplier.push({
      name: m.name,
      slug: m.slug,
      appliedTo: m.appliedTo,
      rate: m.value,
      baseHours: bucketHours,
      additionalHours: add,
    });
    additionalHours = roundMoney(additionalHours + add);
  }

  return {
    baseHours: hours.totalHours,
    perMultiplier,
    additionalHours,
    totalHours: roundMoney(hours.totalHours + additionalHours),
  };
}
