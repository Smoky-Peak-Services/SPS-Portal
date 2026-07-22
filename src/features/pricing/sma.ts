/**
 * Module A — annual SMA engine (prompt 11).
 *
 * Total Annual SMA Price = Base Rate + System Value Modifier
 *
 * Bank of Hours (pre-purchased discounted service hours) is deferred — not
 * priced here until that catalog piece is rebuilt.
 *
 * SVM is applied to systemMaterialValue (material value only) — never total
 * project value including labor.
 *
 * SMA and monthly services are separate code paths; this module never prices
 * MONTHLY_SERVICE rows.
 *
 * purchaseType (DIRECT | SMA_BUNDLED) selects both the base-tier column and the
 * SVM % together.
 */
import {
  calculateAnnualSmaPriceInputSchema,
  type SmaBaseTierInput,
  type SmaPurchaseType,
  type SmaSvmInput,
} from "./schemas";
import { selectSmaBaseTier } from "./sma-tier";
import { roundMoney } from "./rate-for";

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
  // SVM on material value only — never include labor in the basis.
  const svmAmount = roundMoney(input.systemMaterialValue * svmPct);

  const total = roundMoney(baseRate + svmAmount);

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
