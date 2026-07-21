import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import { CABIN_LABOR_MULTIPLIERS, CABIN_LABOR_POSITIONS } from "./cabin-rates";
import {
  IS_COM_LABOR_MULTIPLIERS,
  IS_COM_LABOR_POSITIONS,
  SERVICE_TECH_SKU,
} from "./is-com-rates";
import {
  IS_RES_LABOR_MULTIPLIERS,
  IS_RES_LABOR_POSITIONS,
} from "./is-res-rates";
import { distributeQuotedLabor } from "./quoted-labor";
import { roundMoney } from "./rate-for";
import { recomputeRates } from "./recompute";
import { quotedAllocationSchema, laborRateTypeSchema } from "./schemas";
import { calculateServiceTicketLabor } from "./service-labor";

const installPositions = IS_COM_LABOR_POSITIONS.filter(
  (p) => p.context === "INSTALL",
).map((p) => ({
  sku: p.sku,
  title: p.title,
  context: p.context as "INSTALL",
  quotedAllocationPct: p.quotedAllocationPct,
  standardBillingRate: p.standardBillingRate,
  afterHoursRate: p.afterHoursRate,
  holidayRate: p.holidayRate,
  actualCostOfLabor: p.actualCostOfLabor,
}));

const serviceTech = IS_COM_LABOR_POSITIONS.find(
  (p) => p.sku === SERVICE_TECH_SKU,
)!;

describe("recomputeRates", () => {
  it("reproduces every stored IS-COM rate from base × multipliers", () => {
    for (const p of IS_COM_LABOR_POSITIONS) {
      const derived = recomputeRates(
        IS_COM_LABOR_MULTIPLIERS,
        p.baseHourlyRate,
      );
      assert.equal(derived.actualCostOfLabor, p.actualCostOfLabor, p.sku);
      assert.equal(derived.standardBillingRate, p.standardBillingRate, p.sku);
      assert.equal(derived.afterHoursRate, p.afterHoursRate, p.sku);
      assert.equal(derived.holidayRate, p.holidayRate, p.sku);
      // No discounted multiplier for IS-COM → derived discounted is null.
      assert.equal(derived.discountedRate, null, p.sku);
    }
  });

  it("IS-RES Tech 1&2: 18 → 33.30 / 46.62 / 67.60 / 81.59 (prompt 16 checklist)", () => {
    const derived = recomputeRates(IS_RES_LABOR_MULTIPLIERS, 18);
    assert.equal(derived.actualCostOfLabor, 33.3);
    assert.equal(derived.standardBillingRate, 46.62);
    assert.equal(derived.afterHoursRate, 67.6);
    assert.equal(derived.holidayRate, 81.59);
    assert.equal(derived.discountedRate, null);
  });

  it("derives Cabin discounted from the standard chain when the multiplier is set", () => {
    for (const p of CABIN_LABOR_POSITIONS) {
      const derived = recomputeRates(CABIN_LABOR_MULTIPLIERS, p.baseHourlyRate);
      assert.notEqual(derived.discountedRate, null, p.sku);
      // Seed literals keep extra sheet digits (e.g. 41.958); the shared
      // function cent-rounds the same chain.
      assert.equal(
        derived.discountedRate,
        roundMoney(p.discountedRate!),
        p.sku,
      );
      assert.equal(derived.actualCostOfLabor, p.actualCostOfLabor, p.sku);
      assert.equal(derived.standardBillingRate, p.standardBillingRate, p.sku);
    }
  });

  it("standard-billing multiplier change cascades to Std/AH/Hol/Disc", () => {
    const before = recomputeRates(IS_RES_LABOR_MULTIPLIERS, 18);
    const after = recomputeRates(
      { ...IS_RES_LABOR_MULTIPLIERS, standardBillingMultiplier: 1.3 },
      18,
    );
    assert.equal(after.actualCostOfLabor, before.actualCostOfLabor);
    assert.equal(after.standardBillingRate, 43.29); // 33.30 × 1.30
    assert.ok(after.afterHoursRate < before.afterHoursRate);
    assert.ok(after.holidayRate < before.holidayRate);
  });
});

describe("distributeQuotedLabor", () => {
  it("STANDARD 100h → blend hours and $8,898.80 billable", () => {
    const result = distributeQuotedLabor(100, installPositions, "STANDARD");
    assert.equal(result.roles.length, 4);
    assert.equal(result.roles[0]!.hours, 50);
    assert.equal(result.roles[1]!.hours, 20);
    assert.equal(result.roles[2]!.hours, 15);
    assert.equal(result.roles[3]!.hours, 15);
    assert.equal(result.roles[0]!.billable, 3147.0);
    assert.equal(result.roles[1]!.billable, 1818.2);
    assert.equal(result.roles[2]!.billable, 1678.35);
    assert.equal(result.roles[3]!.billable, 2255.25);
    assert.equal(result.billable, 8898.8);
  });

  it("AFTER_HOURS / HOLIDAY use rate columns; costBasis stays constant", () => {
    const std = distributeQuotedLabor(100, installPositions, "STANDARD");
    const ah = distributeQuotedLabor(100, installPositions, "AFTER_HOURS");
    const hol = distributeQuotedLabor(100, installPositions, "HOLIDAY");
    assert.equal(ah.costBasis, std.costBasis);
    assert.equal(hol.costBasis, std.costBasis);
    assert.ok(ah.billable > std.billable);
    assert.ok(hol.billable > ah.billable);
    assert.equal(ah.roles[0]!.rateUsed, 91.26);
    assert.equal(hol.roles[0]!.rateUsed, 110.14);
  });

  it("rejects SERVICE / LAB-COM-SVC-SIS in quoted input", () => {
    assert.throws(
      () =>
        distributeQuotedLabor(
          10,
          [
            ...installPositions.slice(0, 3),
            {
              sku: SERVICE_TECH_SKU,
              title: "Service Technician",
              context: "SERVICE",
              quotedAllocationPct: 15,
              standardBillingRate: 76.92,
              afterHoursRate: 111.54,
              holidayRate: 134.62,
              actualCostOfLabor: 40.7,
            },
          ],
          "STANDARD",
        ),
      ZodError,
    );
  });

  it("rejects allocation summing ≠ 100%", () => {
    assert.throws(
      () =>
        quotedAllocationSchema.parse(
          installPositions.map((p, i) =>
            i === 0 ? { ...p, quotedAllocationPct: 40 } : p,
          ),
        ),
      ZodError,
    );
  });
});

function toQuotedInput(p: {
  sku: string;
  title: string;
  context: "INSTALL" | "SERVICE";
  quotedAllocationPct: number;
  standardBillingRate: number;
  afterHoursRate: number;
  holidayRate: number;
  actualCostOfLabor: number;
}) {
  return {
    sku: p.sku,
    title: p.title,
    context: p.context,
    quotedAllocationPct: p.quotedAllocationPct,
    standardBillingRate: p.standardBillingRate,
    afterHoursRate: p.afterHoursRate,
    holidayRate: p.holidayRate,
    actualCostOfLabor: p.actualCostOfLabor,
  };
}

describe("per-scope blends (prompt 14)", () => {
  const resInstall = IS_RES_LABOR_POSITIONS.filter(
    (p) => p.context === "INSTALL",
  ).map(toQuotedInput);
  const cabinInstall = CABIN_LABOR_POSITIONS.filter(
    (p) => p.context === "INSTALL",
  ).map(toQuotedInput);

  it("IS-Res STANDARD 100h → 60/25/15 blend and $5,723.90 billable", () => {
    const result = distributeQuotedLabor(100, resInstall, "STANDARD");
    assert.equal(result.roles.length, 3);
    assert.equal(result.roles[0]!.hours, 60);
    assert.equal(result.roles[1]!.hours, 25);
    assert.equal(result.roles[2]!.hours, 15);
    assert.equal(result.billable, 5723.9);
  });

  it("Cabin STANDARD 100h → 70/20/10 blend and $4,921.00 billable", () => {
    const result = distributeQuotedLabor(100, cabinInstall, "STANDARD");
    assert.equal(result.roles.length, 3);
    assert.equal(result.roles[0]!.hours, 70);
    assert.equal(result.roles[1]!.hours, 20);
    assert.equal(result.roles[2]!.hours, 10);
    assert.equal(result.billable, 4921.0);
  });

  it("rejects Cabin Contractor Coordination (SERVICE) in quoted input without hardcoded SKUs", () => {
    const cco = CABIN_LABOR_POSITIONS.find((p) => p.sku === "LAB-CBN-CCO-SPC")!;
    assert.throws(
      () => quotedAllocationSchema.parse([...cabinInstall, toQuotedInput(cco)]),
      ZodError,
    );
  });

  it("Cabin discounted rates equal standard × 0.90 from the sheet", () => {
    assert.equal(CABIN_LABOR_MULTIPLIERS.discountedMultiplier, 0.9);
    for (const p of CABIN_LABOR_POSITIONS) {
      assert.ok(p.discountedRate !== null, p.sku);
      const derived = p.standardBillingRate * 0.9;
      assert.ok(
        Math.abs(p.discountedRate! - derived) < 1e-9,
        `${p.sku}: ${p.discountedRate} vs ${derived}`,
      );
    }
  });

  it("IS-Res positions carry no discounted rates", () => {
    for (const p of IS_RES_LABOR_POSITIONS) {
      assert.equal(p.discountedRate, null, p.sku);
    }
  });
});

describe("laborRateTypeSchema", () => {
  it("rejects unknown rate types", () => {
    assert.throws(() => laborRateTypeSchema.parse("WEEKEND"), ZodError);
  });
});

describe("calculateServiceTicketLabor", () => {
  it("3h STANDARD = $230.76", () => {
    const result = calculateServiceTicketLabor(
      3,
      {
        sku: serviceTech.sku,
        title: serviceTech.title,
        context: "SERVICE",
        standardBillingRate: serviceTech.standardBillingRate,
        afterHoursRate: serviceTech.afterHoursRate,
        holidayRate: serviceTech.holidayRate,
        actualCostOfLabor: serviceTech.actualCostOfLabor,
      },
      "STANDARD",
    );
    assert.equal(result.billable, 230.76);
    assert.equal(result.rateUsed, 76.92);
  });
});
