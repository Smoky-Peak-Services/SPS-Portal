/**
 * Module A — quoted (job) labor: weighted blend across INSTALL positions.
 *
 * Internals use Decimal; money is rounded once per role line and once on the
 * document totals (sum of exact role amounts, then cent-round). Hours for
 * clean percentage splits stay exact (50% of 100h = 50).
 *
 * Cost basis note: the rate sheet stores a single actualCostOfLabor per role with no
 * after-hours/holiday cost variant. costBasis is therefore independent of rateType.
 */
import { Prisma } from "@prisma/client";
import {
  distributeQuotedLaborInputSchema,
  type QuotedLaborPositionInput,
  type LaborRateTypeInput,
} from "./schemas";
import { rateFor, roundMoneyDecimal, toDecimal } from "./rate-for";

const Decimal = Prisma.Decimal;

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
  let billableExact = new Decimal(0);
  let costExact = new Decimal(0);
  const totalH = toDecimal(parsed.totalHours);

  for (const p of parsed.positions) {
    const hours = totalH.mul(p.quotedAllocationPct).div(100);
    const rateUsed = rateFor(p, parsed.rateType);
    const roleBillableExact = hours.mul(rateUsed);
    const roleCostExact = hours.mul(p.actualCostOfLabor);
    billableExact = billableExact.add(roleBillableExact);
    costExact = costExact.add(roleCostExact);
    roles.push({
      sku: p.sku,
      title: p.title,
      hours: hours.toNumber(),
      allocationPct: p.quotedAllocationPct,
      rateUsed,
      billable: roundMoneyDecimal(roleBillableExact).toNumber(),
      cost: roundMoneyDecimal(roleCostExact).toNumber(),
    });
  }

  const billable = roundMoneyDecimal(billableExact).toNumber();
  const costBasis = roundMoneyDecimal(costExact).toNumber();
  const blendedMarginPct =
    billable > 0
      ? roundMoneyDecimal(
          toDecimal(billable).sub(costBasis).div(billable).mul(100),
        ).toNumber()
      : 0;

  return {
    rateType: parsed.rateType,
    totalHours: parsed.totalHours,
    roles,
    billable,
    costBasis,
    blendedMarginPct,
  };
}
