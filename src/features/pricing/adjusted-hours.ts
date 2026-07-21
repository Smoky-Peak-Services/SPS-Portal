/**
 * Complexity hours adjuster (prompt 10).
 *
 * STRICT RULE: multipliers ONLY ever touch baseHours. Never multiply a labor
 * dollar amount, billable total, cost basis, or project price by a multiplier.
 *
 * Additive (not compounded): each rate is applied independently against baseHours,
 * then the additions are summed. No cap — every active multiplier applies in full.
 *
 * After Hours Required Installation (0.20) may intentionally stack with
 * LaborRateType.AFTER_HOURS (higher $/hr) — that is deliberate per the sheet note;
 * do not auto-block the combination.
 *
 * totalHours from this function is what later quoting passes into
 * distributeQuotedLabor (prompt 09) — no quote entity wiring here yet.
 */
import { roundMoney } from "./rate-for";

export type ActiveComplexityMultiplier = {
  name: string;
  slug?: string;
  modificationRate: number;
};

export type ComplexityHoursBreakdown = {
  name: string;
  slug?: string;
  rate: number;
  additionalHours: number;
};

export type AdjustedLaborHoursResult = {
  baseHours: number;
  perMultiplier: ComplexityHoursBreakdown[];
  additionalHours: number;
  totalHours: number;
};

export function calculateAdjustedLaborHours(
  baseHours: number,
  activeMultipliers: ActiveComplexityMultiplier[],
): AdjustedLaborHoursResult {
  if (!Number.isFinite(baseHours) || baseHours < 0) {
    throw new Error("baseHours must be a finite non-negative number");
  }

  const perMultiplier: ComplexityHoursBreakdown[] = [];
  let additionalHours = 0;

  for (const m of activeMultipliers) {
    if (!Number.isFinite(m.modificationRate) || m.modificationRate < 0) {
      throw new Error(
        `modificationRate for "${m.name}" must be a finite non-negative decimal`,
      );
    }
    const add = roundMoney(baseHours * m.modificationRate);
    perMultiplier.push({
      name: m.name,
      slug: m.slug,
      rate: m.modificationRate,
      additionalHours: add,
    });
    additionalHours = roundMoney(additionalHours + add);
  }

  return {
    baseHours,
    perMultiplier,
    additionalHours,
    totalHours: roundMoney(baseHours + additionalHours),
  };
}
