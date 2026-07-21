/**
 * Base package rate adjuster (prompt 14, Cabin Services).
 *
 * Counterpart to calculateAdjustedLaborHours for BASE_PACKAGE_RATE rows:
 * FIXED adds `value` dollars per billing cycle; PERCENT adds
 * `basePackageRate * value`. Additive, not compounded; no cap.
 * Labor-bucket rows (TOTAL_LABOR / PROGRAMMING_LABOR / NETWORK_LABOR)
 * belong to the hours engine and are rejected here.
 */
import { roundMoney } from "./rate-for";
import type { ActiveComplexityMultiplier } from "./adjusted-hours";

export type PackageRateBreakdown = {
  name: string;
  slug?: string;
  multiplierType: "PERCENT" | "FIXED";
  value: number;
  additionalAmount: number;
};

export type AdjustedPackageRateResult = {
  basePackageRate: number;
  perMultiplier: PackageRateBreakdown[];
  additionalAmount: number;
  totalRate: number;
};

export function calculateAdjustedPackageRate(
  basePackageRate: number,
  activeMultipliers: ActiveComplexityMultiplier[],
): AdjustedPackageRateResult {
  if (!Number.isFinite(basePackageRate) || basePackageRate < 0) {
    throw new Error("basePackageRate must be a finite non-negative number");
  }

  const perMultiplier: PackageRateBreakdown[] = [];
  let additionalAmount = 0;

  for (const m of activeMultipliers) {
    if (m.appliedTo !== "BASE_PACKAGE_RATE") {
      throw new Error(
        `Multiplier "${m.name}" applies to ${m.appliedTo} — use calculateAdjustedLaborHours, not the package-rate engine`,
      );
    }
    if (!Number.isFinite(m.value) || m.value < 0) {
      throw new Error(
        `value for "${m.name}" must be a finite non-negative number`,
      );
    }

    const add = roundMoney(
      m.multiplierType === "FIXED" ? m.value : basePackageRate * m.value,
    );
    perMultiplier.push({
      name: m.name,
      slug: m.slug,
      multiplierType: m.multiplierType,
      value: m.value,
      additionalAmount: add,
    });
    additionalAmount = roundMoney(additionalAmount + add);
  }

  return {
    basePackageRate,
    perMultiplier,
    additionalAmount,
    totalRate: roundMoney(basePackageRate + additionalAmount),
  };
}
