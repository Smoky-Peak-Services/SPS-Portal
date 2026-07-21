import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CABIN_COMPLEXITY_MULTIPLIERS } from "./cabin-complexity";
import { CABIN_SERVICE_PLANS } from "./cabin-service-plans";
import { calculateAdjustedPackageRate } from "./package-rate";

describe("Cabin service plan literals", () => {
  it("18 rows: 6 per plan type, unique SKUs", () => {
    assert.equal(CABIN_SERVICE_PLANS.length, 18);
    for (const planType of ["MAINTENANCE", "INSPECTION", "FULL_SERVICE"]) {
      assert.equal(
        CABIN_SERVICE_PLANS.filter((p) => p.planType === planType).length,
        6,
        planType,
      );
    }
    const skus = new Set(CABIN_SERVICE_PLANS.map((p) => p.sku));
    assert.equal(skus.size, 18);
  });

  it("each plan type has 5 rated standard tiers and 1 custom-quote row", () => {
    for (const planType of ["MAINTENANCE", "INSPECTION", "FULL_SERVICE"]) {
      const rows = CABIN_SERVICE_PLANS.filter((p) => p.planType === planType);
      const standard = rows.filter((p) => !p.isCustomQuote);
      const custom = rows.filter((p) => p.isCustomQuote);
      assert.equal(standard.length, 5, planType);
      assert.equal(custom.length, 1, planType);
      for (const p of standard) {
        assert.ok(p.rate !== null && p.rate > 0, p.sku);
        assert.ok(p.bedrooms !== null && p.maxBathrooms !== null, p.sku);
      }
      assert.equal(custom[0]!.rate, null);
      assert.equal(custom[0]!.bedrooms, null);
    }
  });

  it("sheet rates: MP 1BR $125 … FSP 5BR $345", () => {
    const bySku = Object.fromEntries(
      CABIN_SERVICE_PLANS.map((p) => [p.sku, p]),
    );
    assert.equal(bySku["MP-1BE-1BA-STD"]!.rate, 125);
    assert.equal(bySku["MP-5BE-5BA-STD"]!.rate, 250);
    assert.equal(bySku["CIP-1BE-1BA-STD"]!.rate, 95);
    assert.equal(bySku["CIP-5BE-5BA-STD"]!.rate, 175);
    assert.equal(bySku["FSP-1BE-1BA-STD"]!.rate, 185);
    assert.equal(bySku["FSP-5BE-5BA-STD"]!.rate, 345);
  });

  it("base package rate feeds calculateAdjustedPackageRate (MP 3BR + hot tub + gas fireplace)", () => {
    const mp3 = CABIN_SERVICE_PLANS.find((p) => p.sku === "MP-3BE-3BA-STD")!;
    const bySlug = Object.fromEntries(
      CABIN_COMPLEXITY_MULTIPLIERS.map((m) => [m.slug, m]),
    );
    const hotTub = bySlug["on-premise-swim-spa-or-hot-tub"]!; // FIXED $12
    const gas = bySlug["gas-fireplace"]!; // PERCENT 0.04
    const result = calculateAdjustedPackageRate(mp3.rate!, [
      {
        name: hotTub.name,
        slug: hotTub.slug,
        multiplierType: hotTub.multiplierType,
        appliedTo: hotTub.appliedTo,
        value: hotTub.value,
      },
      {
        name: gas.name,
        slug: gas.slug,
        multiplierType: gas.multiplierType,
        appliedTo: gas.appliedTo,
        value: gas.value,
      },
    ]);
    // 175 + 12 + 175 × 0.04 = 194
    assert.equal(result.totalRate, 194);
  });
});
