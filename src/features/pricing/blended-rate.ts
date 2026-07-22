/**
 * Blended INSTALL labor $/hr for a scope (prompt 17).
 * Reuses distributeQuotedLabor(1h) — never invent a second blend formula.
 */
import type { LaborPosition, LaborRateType } from "@prisma/client";
import { distributeQuotedLabor } from "./quoted-labor";
import type { QuotedLaborPositionInput } from "./schemas";

export function positionsToQuotedInput(
  positions: Pick<
    LaborPosition,
    | "sku"
    | "title"
    | "context"
    | "quotedAllocationPct"
    | "standardBillingRate"
    | "afterHoursRate"
    | "holidayRate"
    | "actualCostOfLabor"
  >[],
): QuotedLaborPositionInput[] {
  return positions.map((p) => ({
    sku: p.sku,
    title: p.title,
    context: p.context,
    quotedAllocationPct: Number(p.quotedAllocationPct),
    standardBillingRate: Number(p.standardBillingRate),
    afterHoursRate: Number(p.afterHoursRate),
    holidayRate: Number(p.holidayRate),
    actualCostOfLabor: Number(p.actualCostOfLabor),
  }));
}

/**
 * Billable $/hr for one blended INSTALL hour at the given rate type.
 * Pass only INSTALL positions (SERVICE roles will be rejected by the engine).
 */
export function blendedInstallRate(
  installPositions: QuotedLaborPositionInput[],
  rateType: LaborRateType = "STANDARD",
): number {
  return distributeQuotedLabor(1, installPositions, rateType).billable;
}
