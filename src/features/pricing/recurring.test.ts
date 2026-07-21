import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  IS_COM_BOH_RATE_FACTOR,
  IS_COM_RECURRING_FEES,
  IS_COM_RECURRING_MARKUP,
  IS_COM_SMA_BUNDLE_FACTOR,
} from "./is-com-recurring";
import { IS_COM_LABOR_POSITIONS } from "./is-com-rates";
import { resolveMonthlyServiceRate } from "./monthly-service";
import { bankOfHoursHourlyRate, calculateAnnualSmaPrice } from "./sma";
import { selectSmaBaseTier } from "./sma-tier";
import {
  calculateAnnualSmaPriceInputSchema,
  monthlyServiceItemSchema,
  refineFeeTypeBillingCycle,
  smaBaseTierSchema,
} from "./schemas";
import { z } from "zod";

const tiers = IS_COM_RECURRING_FEES.filter((r) => r.feeType === "SMA_BASE_TIER").map(
  (r) => ({
    sku: r.sku,
    feeType: "SMA_BASE_TIER" as const,
    billingCycle: "ANNUAL" as const,
    valueType: "CURRENCY" as const,
    directPurchaseRate: r.directPurchaseRate,
    smaBundledRate: r.smaBundledRate,
    systemValueMin: r.systemValueMin,
    systemValueMax: r.systemValueMax,
  }),
);

const svmRow = IS_COM_RECURRING_FEES.find((r) => r.sku === "REC-SMA_SVM-ANN")!;
const svm = {
  sku: svmRow.sku,
  feeType: "SMA_SVM" as const,
  billingCycle: "ANNUAL" as const,
  valueType: "PERCENT" as const,
  directPurchaseRate: svmRow.directPurchaseRate,
  smaBundledRate: svmRow.smaBundledRate,
};

const tech12 = IS_COM_LABOR_POSITIONS.find((p) => p.sku === "LAB-COM-T12-SIS")!;

const monitoring = IS_COM_RECURRING_FEES.find((r) => r.sku === "REC-MON-MON")!;

describe("IS-Commercial recurring seed literals", () => {
  it("has 11 rows and no $18.99 monitoring", () => {
    assert.equal(IS_COM_RECURRING_FEES.length, 11);
    assert.equal(monitoring.baseCost, 39.99);
    assert.equal(monitoring.directPurchaseRate, 51.99);
    assert.equal(monitoring.smaBundledRate, 46.79);
    assert.ok(
      !IS_COM_RECURRING_FEES.some(
        (r) => r.sku === "REC-MON-MON" && r.baseCost === 18.99,
      ),
    );
  });

  it("CURRENCY rows follow direct ≈ base × 1.30 and bundled ≈ direct × 0.90", () => {
    for (const row of IS_COM_RECURRING_FEES) {
      if (row.valueType !== "CURRENCY") continue;
      if (row.feeType === "SMA_BANK_OF_HOURS") continue; // placeholders
      const expectedDirect =
        Math.round(row.baseCost * IS_COM_RECURRING_MARKUP * 100) / 100;
      const expectedBundled =
        Math.round(row.directPurchaseRate * IS_COM_SMA_BUNDLE_FACTOR * 100) /
        100;
      assert.equal(
        row.directPurchaseRate,
        expectedDirect,
        `${row.sku} direct`,
      );
      assert.equal(
        row.smaBundledRate,
        expectedBundled,
        `${row.sku} bundled`,
      );
    }
  });
});

describe("selectSmaBaseTier boundaries", () => {
  it("5000 → TR1, 5000.01 → TR2, 30000 → TR4, 30000.01 → TR5, 499 → none", () => {
    assert.equal(selectSmaBaseTier(5000, tiers)?.sku, "REC-AMA-TR1-ANN");
    assert.equal(selectSmaBaseTier(5000.01, tiers)?.sku, "REC-AMA-TR2-ANN");
    assert.equal(selectSmaBaseTier(30000, tiers)?.sku, "REC-AMA-TR4-ANN");
    assert.equal(selectSmaBaseTier(30000.01, tiers)?.sku, "REC-AMA-TR5-ANN");
    assert.equal(selectSmaBaseTier(499, tiers), null);
    assert.equal(selectSmaBaseTier(500, tiers)?.sku, "REC-AMA-TR1-ANN");
    assert.equal(selectSmaBaseTier(12000, tiers)?.sku, "REC-AMA-TR3-ANN");
  });
});

describe("calculateAnnualSmaPrice", () => {
  it("DIRECT $12k + 10 BOH → $3,738.46", () => {
    const result = calculateAnnualSmaPrice({
      systemMaterialValue: 12000,
      purchaseType: "DIRECT",
      bankOfHoursQty: 10,
      tiers,
      svm,
      tech12StandardRate: tech12.standardBillingRate,
    });
    assert.equal(result.tierSku, "REC-AMA-TR3-ANN");
    assert.equal(result.baseRate, 1300);
    assert.equal(result.svmAmount, 1872);
    assert.equal(result.bankOfHours, 566.46);
    assert.equal(result.total, 3738.46);
  });

  it("SMA_BUNDLED $12k + 10 BOH → $3,421.26", () => {
    const result = calculateAnnualSmaPrice({
      systemMaterialValue: 12000,
      purchaseType: "SMA_BUNDLED",
      bankOfHoursQty: 10,
      tiers,
      svm,
      tech12StandardRate: tech12.standardBillingRate,
    });
    assert.equal(result.baseRate, 1170);
    assert.equal(result.svmAmount, 1684.8);
    assert.equal(result.bankOfHours, 566.46);
    assert.equal(result.total, 3421.26);
  });

  it("rejects unresolvable tier via Zod", () => {
    assert.throws(
      () =>
        calculateAnnualSmaPriceInputSchema.parse({
          systemMaterialValue: 499,
          purchaseType: "DIRECT",
          bankOfHoursQty: 0,
          tiers,
          svm,
          tech12StandardRate: tech12.standardBillingRate,
        }),
      ZodError,
    );
  });

  it("BOH hourly rate is round(T12 × 0.90, 2) and tracks T12 changes", () => {
    assert.equal(
      bankOfHoursHourlyRate(tech12.standardBillingRate),
      Math.round(tech12.standardBillingRate * IS_COM_BOH_RATE_FACTOR * 100) /
        100,
    );
    assert.equal(bankOfHoursHourlyRate(62.94), 56.65);

    const bumped = calculateAnnualSmaPrice({
      systemMaterialValue: 12000,
      purchaseType: "DIRECT",
      bankOfHoursQty: 10,
      tiers,
      svm,
      tech12StandardRate: 70,
    });
    assert.equal(bumped.bankOfHoursRate, 63);
    assert.equal(bumped.bankOfHours, 630);
  });
});

describe("resolveMonthlyServiceRate", () => {
  const item = {
    sku: monitoring.sku,
    feeType: "MONTHLY_SERVICE" as const,
    billingCycle: "MONTHLY" as const,
    valueType: "CURRENCY" as const,
    directPurchaseRate: monitoring.directPurchaseRate,
    smaBundledRate: monitoring.smaBundledRate,
  };

  it("with SMA → 46.79; without → 51.99", () => {
    assert.equal(resolveMonthlyServiceRate(item, true), 46.79);
    assert.equal(resolveMonthlyServiceRate(item, false), 51.99);
  });

  it("rejects SMA feeType as monthly item (structural)", () => {
    assert.throws(
      () =>
        monthlyServiceItemSchema.parse({
          sku: "REC-SMA_SVM-ANN",
          feeType: "SMA_SVM",
          billingCycle: "ANNUAL",
          valueType: "PERCENT",
          directPurchaseRate: 0.156,
          smaBundledRate: 0.1404,
        }),
      ZodError,
    );
  });
});

describe("feeType ↔ billingCycle refine", () => {
  it("rejects SMA_BASE_TIER with MONTHLY", () => {
    const schema = z
      .object({
        feeType: z.literal("SMA_BASE_TIER"),
        billingCycle: z.enum(["ANNUAL", "MONTHLY"]),
      })
      .superRefine((row, ctx) => {
        refineFeeTypeBillingCycle(row.feeType, row.billingCycle, ctx);
      });
    assert.throws(
      () => schema.parse({ feeType: "SMA_BASE_TIER", billingCycle: "MONTHLY" }),
      ZodError,
    );
  });

  it("rejects MONTHLY_SERVICE with ANNUAL", () => {
    const schema = z
      .object({
        feeType: z.literal("MONTHLY_SERVICE"),
        billingCycle: z.enum(["ANNUAL", "MONTHLY"]),
      })
      .superRefine((row, ctx) => {
        refineFeeTypeBillingCycle(row.feeType, row.billingCycle, ctx);
      });
    assert.throws(
      () =>
        schema.parse({ feeType: "MONTHLY_SERVICE", billingCycle: "ANNUAL" }),
      ZodError,
    );
  });

  it("accepts valid SMA base tier shape", () => {
    const parsed = smaBaseTierSchema.parse(tiers[0]);
    assert.equal(parsed.sku, "REC-AMA-TR1-ANN");
  });
});
