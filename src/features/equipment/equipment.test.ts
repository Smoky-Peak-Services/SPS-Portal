import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EQUIPMENT_MARKUP, sellPriceFromCost } from "./schemas";

describe("equipment sellPriceFromCost", () => {
  it("uses the hard-baked 15% markup constant", () => {
    assert.equal(EQUIPMENT_MARKUP, 1.15);
  });

  it("maps $475 cost to $546.25 sell", () => {
    assert.equal(sellPriceFromCost(475), 546.25);
  });

  it("rounds to two decimal places", () => {
    assert.equal(sellPriceFromCost(100), 115);
    assert.equal(sellPriceFromCost(10.11), 11.63);
  });
});
