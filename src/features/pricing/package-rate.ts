/**
 * Base package rate adjuster (prompt 14, Cabin Services).
 * Decimal internals; round once on each addition and on the document total.
 */
import { Prisma } from "@prisma/client";
import { roundMoneyDecimal, toDecimal } from "./rate-for";
import type { ActiveComplexityMultiplier } from "./adjusted-hours";

const Decimal = Prisma.Decimal;

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
  let additionalExact = new Decimal(0);
  const base = toDecimal(basePackageRate);

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

    const addExact =
      m.multiplierType === "FIXED" ? toDecimal(m.value) : base.mul(m.value);
    additionalExact = additionalExact.add(addExact);
    perMultiplier.push({
      name: m.name,
      slug: m.slug,
      multiplierType: m.multiplierType,
      value: m.value,
      additionalAmount: roundMoneyDecimal(addExact).toNumber(),
    });
  }

  return {
    basePackageRate,
    perMultiplier,
    additionalAmount: roundMoneyDecimal(additionalExact).toNumber(),
    totalRate: roundMoneyDecimal(base.add(additionalExact)).toNumber(),
  };
}
