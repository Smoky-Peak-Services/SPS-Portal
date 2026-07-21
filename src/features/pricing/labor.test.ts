import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError } from "zod";
import {
  IS_COM_LABOR_MULTIPLIERS,
  IS_COM_LABOR_POSITIONS,
  SERVICE_TECH_SKU,
} from "./is-com-rates";
import { distributeQuotedLabor } from "./quoted-labor";
import { recomputeRates } from "./recompute";
import {
  quotedAllocationSchema,
  laborRateTypeSchema,
} from "./schemas";
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
    }
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
