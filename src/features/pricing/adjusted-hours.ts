/**
 * Complexity hours adjuster (prompt 10, generalized in prompt 14).
 * Internals use Decimal; round once per multiplier addition and once on totals
 * so results match prior cent-rounded hours tests.
 */
import { Prisma } from "@prisma/client";
import { roundMoneyDecimal, toDecimal } from "./rate-for";

const Decimal = Prisma.Decimal;

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
    | "TOTAL_LABOR"
    | "PROGRAMMING_LABOR"
    | "NETWORK_LABOR"
    | "BASE_PACKAGE_RATE";
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
  let additionalExact = new Decimal(0);

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

    const addExact = toDecimal(bucketHours).mul(m.value);
    const add = roundMoneyDecimal(addExact);
    additionalExact = additionalExact.add(addExact);
    perMultiplier.push({
      name: m.name,
      slug: m.slug,
      appliedTo: m.appliedTo,
      rate: m.value,
      baseHours: bucketHours,
      additionalHours: add.toNumber(),
    });
  }

  const additionalHours = roundMoneyDecimal(additionalExact).toNumber();

  return {
    baseHours: hours.totalHours,
    perMultiplier,
    additionalHours,
    totalHours: roundMoneyDecimal(
      toDecimal(hours.totalHours).add(additionalExact),
    ).toNumber(),
  };
}
