import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeServiceLines,
  validateServiceLines,
} from "./service-location";
import { billingMissing, isBillingComplete } from "./billing";

describe("service location lines", () => {
  it("forces commercial to Integrated Systems only", () => {
    assert.deepEqual(
      normalizeServiceLines("COMMERCIAL", [
        "CABIN_SERVICES",
        "INTEGRATED_SYSTEMS",
      ]),
      ["INTEGRATED_SYSTEMS"],
    );
    assert.equal(
      validateServiceLines("COMMERCIAL", ["CABIN_SERVICES"]),
      "Commercial locations can only use Integrated Systems.",
    );
  });

  it("requires a residential service line", () => {
    assert.equal(
      validateServiceLines("RESIDENTIAL", []),
      "Select at least one service line.",
    );
    assert.equal(
      validateServiceLines("RESIDENTIAL", ["CABIN_SERVICES"]),
      null,
    );
  });
});

describe("billing completeness", () => {
  it("reports missing fields", () => {
    assert.equal(
      isBillingComplete({
        billingName: null,
        billingEmail: null,
        billingLine1: null,
        billingCity: null,
        billingRegion: null,
        billingPostal: null,
      }),
      false,
    );
    assert.deepEqual(
      billingMissing({
        billingName: "Acme",
        billingEmail: "a@b.co",
        billingLine1: "1 Main",
        billingCity: "Knoxville",
        billingRegion: "TN",
        billingPostal: "37919",
      }),
      [],
    );
  });
});
