/**
 * Module B — service ticket labor: flat hours × Service Technician rates.
 * Kept separate from quoted-labor so INSTALL blend and SERVICE billing never cross-contaminate.
 *
 * Cost basis note: same as Module A — single actualCostOfLabor; rateType does not change cost.
 */
import {
  calculateServiceTicketLaborInputSchema,
  type LaborRateTypeInput,
} from "./schemas";
import { rateFor, roundMoney, type RateColumns } from "./rate-for";

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
  const billable = roundMoney(parsed.hoursLogged * rateUsed);
  const costBasis = roundMoney(
    parsed.hoursLogged * parsed.position.actualCostOfLabor,
  );
  const marginPct =
    billable > 0 ? roundMoney(((billable - costBasis) / billable) * 100) : 0;

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
