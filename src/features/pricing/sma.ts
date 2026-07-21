/**
 * Module A — annual SMA engine (prompt 11).
 *
 * Total Annual SMA Price = Base Rate + System Value Modifier + Bank of Hours
 *
 * SVM is applied to systemMaterialValue (material value only) — never total
 * project value including labor.
 *
 * SMA and monthly services are separate code paths; this module never prices
 * MONTHLY_SERVICE rows.
 *
 * purchaseType (DIRECT | SMA_BUNDLED) selects both the base-tier column and the
 * SVM % together (prompt 11 modeled semantics — confirm with Ryan if base and
 * SVM should ever use different columns independently).
 */
import {
  calculateAnnualSmaPriceInputSchema,
  type SmaBaseTierInput,
  type SmaPurchaseType,
  type SmaSvmInput,
} from "./schemas";
import { selectSmaBaseTier } from "./sma-tier";
import { IS_COM_BOH_RATE_FACTOR } from "./is-com-recurring";
import { roundMoney } from "./rate-for";

export { selectSmaBaseTier } from "./sma-tier";

export type SmaBaseTierSelection = SmaBaseTierInput | null;

export function bankOfHoursHourlyRate(tech12StandardRate: number): number {
  return roundMoney(tech12StandardRate * IS_COM_BOH_RATE_FACTOR);
}

export type AnnualSmaPriceResult = {
  purchaseType: SmaPurchaseType;
  systemMaterialValue: number;
  tierSku: string;
  baseRate: number;
  svmPct: number;
  /** Material value × SVM % — material only, not labor. */
  svmAmount: number;
  bankOfHoursQty: number;
  bankOfHoursRate: number;
  bankOfHours: number;
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
  bankOfHoursQty: number;
  tiers: SmaBaseTierInput[];
  svm: SmaSvmInput;
  tech12StandardRate: number;
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

  const bankOfHoursRate = bankOfHoursHourlyRate(input.tech12StandardRate);
  // Line total uses unrounded (rate × qty) then cent-rounds once so
  // 62.94 × 0.90 × 10 = 566.46 (not 56.65 × 10 = 566.50).
  const bankOfHours = roundMoney(
    input.tech12StandardRate * IS_COM_BOH_RATE_FACTOR * input.bankOfHoursQty,
  );

  const total = roundMoney(baseRate + svmAmount + bankOfHours);

  return {
    purchaseType: input.purchaseType,
    systemMaterialValue: input.systemMaterialValue,
    tierSku: tier.sku,
    baseRate,
    svmPct,
    svmAmount,
    bankOfHoursQty: input.bankOfHoursQty,
    bankOfHoursRate,
    bankOfHours,
    total,
  };
}
