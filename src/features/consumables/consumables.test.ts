import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IS_COM_LABOR_POSITIONS } from "@/features/pricing/is-com-rates";
import { IS_RES_LABOR_POSITIONS } from "@/features/pricing/is-res-rates";
import { CABIN_LABOR_POSITIONS } from "@/features/pricing/cabin-rates";
import { blendedInstallRate } from "@/features/pricing/blended-rate";
import { sellPriceFrom } from "./schemas";

describe("consumable sellPriceFrom", () => {
  it("IS markup 50%: $5 → $7.50", () => {
    assert.equal(sellPriceFrom(5, 0.5, false), 7.5);
  });

  it("Cabin markup 30%: $2.65 → $3.45", () => {
    assert.equal(sellPriceFrom(2.65, 0.3, false), 3.45);
  });

  it("market-rate rows have no sell price", () => {
    assert.equal(sellPriceFrom(null, 0.3, true), null);
    assert.equal(sellPriceFrom(10, 0.3, true), null);
  });
});

describe("blendedInstallRate for consumable labor reference", () => {
  it("IS-COM blend matches distributeQuotedLabor(1h).billable", () => {
    const install = IS_COM_LABOR_POSITIONS.filter(
      (p) => p.context === "INSTALL",
    );
    const rate = blendedInstallRate(install, "STANDARD");
    // Cent-rounding per role means 1h ≠ total/100 exactly (100h → $8,898.80).
    assert.equal(rate, 88.98);
  });

  it("IS-RES blend differs from IS-COM (segment matters for display)", () => {
    const com = blendedInstallRate(
      IS_COM_LABOR_POSITIONS.filter((p) => p.context === "INSTALL"),
      "STANDARD",
    );
    const res = blendedInstallRate(
      IS_RES_LABOR_POSITIONS.filter((p) => p.context === "INSTALL"),
      "STANDARD",
    );
    assert.notEqual(com, res);
    assert.ok(res > 0);
  });

  it("Cabin blend uses INSTALL positions only", () => {
    const install = CABIN_LABOR_POSITIONS.filter(
      (p) => p.context === "INSTALL",
    );
    const rate = blendedInstallRate(install, "STANDARD");
    // 100h → $4,921.00 ⇒ 1h → $49.21
    assert.equal(rate, 49.21);
  });
});
