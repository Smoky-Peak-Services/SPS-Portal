/**
 * Module A — quoted (job) labor: weighted blend across INSTALL positions.
 *
 * Service Technician (LAB-COM-SVC-SIS / context=SERVICE) must NEVER appear here,
 * in a quote line, or in any estimating template — validate via quotedAllocationSchema.
 *
 * Cost basis note: the rate sheet stores a single actualCostOfLabor per role with no
 * after-hours/holiday cost variant. costBasis is therefore independent of rateType,
 * so AFTER_HOURS / HOLIDAY jobs show inflated margin (bill rises, modeled cost does not).
 * If true off-hours margin is needed, add cost multipliers to the sheet — do not invent them.
 */
import {
  distributeQuotedLaborInputSchema,
  type QuotedLaborPositionInput,
  type LaborRateTypeInput,
} from "./schemas";
import { rateFor, roundMoney } from "./rate-for";

export type QuotedRoleBreakdown = {
  sku: string;
  title: string;
  hours: number;
  allocationPct: number;
  rateUsed: number;
  billable: number;
  cost: number;
};

export type QuotedLaborResult = {
  rateType: LaborRateTypeInput;
  totalHours: number;
  roles: QuotedRoleBreakdown[];
  billable: number;
  costBasis: number;
  /** (billable - costBasis) / billable when billable > 0; else 0 */
  blendedMarginPct: number;
};

export function distributeQuotedLabor(
  totalHours: number,
  positions: QuotedLaborPositionInput[],
  rateType: LaborRateTypeInput,
): QuotedLaborResult {
  const parsed = distributeQuotedLaborInputSchema.parse({
    totalHours,
    positions,
    rateType,
  });

  const roles: QuotedRoleBreakdown[] = [];
  let billable = 0;
  let costBasis = 0;

  for (const p of parsed.positions) {
    const hours = roundMoney(
      parsed.totalHours * (p.quotedAllocationPct / 100),
    );
    const rateUsed = rateFor(p, parsed.rateType);
    const roleBillable = roundMoney(hours * rateUsed);
    const roleCost = roundMoney(hours * p.actualCostOfLabor);
    roles.push({
      sku: p.sku,
      title: p.title,
      hours,
      allocationPct: p.quotedAllocationPct,
      rateUsed,
      billable: roleBillable,
      cost: roleCost,
    });
    billable = roundMoney(billable + roleBillable);
    costBasis = roundMoney(costBasis + roleCost);
  }

  const blendedMarginPct =
    billable > 0 ? roundMoney(((billable - costBasis) / billable) * 100) : 0;

  return {
    rateType: parsed.rateType,
    totalHours: parsed.totalHours,
    roles,
    billable,
    costBasis,
    blendedMarginPct,
  };
}
