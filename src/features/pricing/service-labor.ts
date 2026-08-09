/**
 * Module B — service ticket labor: flat hours × Service Technician rates.
 * Internals use Decimal; round once on billable / cost / margin outputs.
 */
import { Prisma } from "@prisma/client";
import {
  calculateServiceTicketLaborInputSchema,
  type LaborRateTypeInput,
} from "./schemas";
import { rateFor, roundMoneyDecimal, toDecimal, type RateColumns } from "./rate-for";

const Decimal = Prisma.Decimal;

export type ServiceLaborPosition = RateColumns & {
  sku: string;
  title: string;
  context: "SERVICE";
};

export type ServiceLaborResult = {
  sku: string;
  title: string;
  hoursLogged: number;
  rateType: LaborRateTypeInput;
  rateUsed: number;
  billable: number;
  costBasis: number;
  marginPct: number;
};

export function calculateServiceTicketLabor(
  hoursLogged: number,
  position: ServiceLaborPosition,
  rateType: LaborRateTypeInput,
): ServiceLaborResult {
  const parsed = calculateServiceTicketLaborInputSchema.parse({
    hoursLogged,
    position,
    rateType,
  });

  const rateUsed = rateFor(parsed.position, parsed.rateType);
  const hours = toDecimal(parsed.hoursLogged);
  const billable = roundMoneyDecimal(hours.mul(rateUsed)).toNumber();
  const costBasis = roundMoneyDecimal(
    hours.mul(parsed.position.actualCostOfLabor),
  ).toNumber();
  const marginPct =
    billable > 0
      ? roundMoneyDecimal(
          new Decimal(billable).sub(costBasis).div(billable).mul(100),
        ).toNumber()
      : 0;

  return {
    sku: parsed.position.sku,
    title: parsed.position.title,
    hoursLogged: parsed.hoursLogged,
    rateType: parsed.rateType,
    rateUsed,
    billable,
    costBasis,
    marginPct,
  };
}
