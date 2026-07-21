/**
 * Module B — monthly service flat subscription rate (prompt 11).
 *
 * Separate from the SMA engine: no SVM parameter exists on this type.
 * customerHasActiveSma is a passed-in boolean seam until SMA contracts exist.
 */
import {
  resolveMonthlyServiceRateInputSchema,
  type MonthlyServiceItemInput,
} from "./schemas";

export function resolveMonthlyServiceRate(
  item: MonthlyServiceItemInput,
  customerHasActiveSma: boolean,
): number {
  const parsed = resolveMonthlyServiceRateInputSchema.parse({
    item,
    customerHasActiveSma,
  });
  return parsed.customerHasActiveSma
    ? parsed.item.smaBundledRate
    : parsed.item.directPurchaseRate;
}
