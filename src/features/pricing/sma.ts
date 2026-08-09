/**
 * Module A — annual SMA engine (prompt 11).
 * Decimal internals; round once on SVM amount and document total.
 */
import {
  calculateAnnualSmaPriceInputSchema,
  type SmaBaseTierInput,
  type SmaPurchaseType,
  type SmaSvmInput,
} from "./schemas";
import { selectSmaBaseTier } from "./sma-tier";
import { roundMoneyDecimal, toDecimal } from "./rate-for";

export { selectSmaBaseTier } from "./sma-tier";

export type SmaBaseTierSelection = SmaBaseTierInput | null;

export type AnnualSmaPriceResult = {
  purchaseType: SmaPurchaseType;
  systemMaterialValue: number;
  tierSku: string;
  baseRate: number;
  svmPct: number;
  /** Material value × SVM % — material only, not labor. */
  svmAmount: number;
  total: number;
};

function rateColumn(
  purchaseType: SmaPurchaseType,
  direct: number,
  bundled: number,
): number {
  return purchaseType === "DIRECT" ? direct : bundled;
}

export function calculateAnnualSmaPrice(raw: {
  systemMaterialValue: number;
  purchaseType: SmaPurchaseType;
  tiers: SmaBaseTierInput[];
  svm: SmaSvmInput;
}): AnnualSmaPriceResult {
  const input = calculateAnnualSmaPriceInputSchema.parse(raw);
  const tier = selectSmaBaseTier(input.systemMaterialValue, input.tiers)!;

  const baseRate = rateColumn(
    input.purchaseType,
    tier.directPurchaseRate,
    tier.smaBundledRate,
  );
  const svmPct = rateColumn(
    input.purchaseType,
    input.svm.directPurchaseRate,
    input.svm.smaBundledRate,
  );
  const svmAmount = roundMoneyDecimal(
    toDecimal(input.systemMaterialValue).mul(svmPct),
  ).toNumber();
  const total = roundMoneyDecimal(toDecimal(baseRate).add(svmAmount)).toNumber();

  return {
    purchaseType: input.purchaseType,
    systemMaterialValue: input.systemMaterialValue,
    tierSku: tier.sku,
    baseRate,
    svmPct,
    svmAmount,
    total,
  };
}
