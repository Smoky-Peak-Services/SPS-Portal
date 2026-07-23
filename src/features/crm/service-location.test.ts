import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeServiceLines,
  validateServiceLines,
  normalizeAddressKey,
  rootOrgServiceLocationDefaults,
  owningDivisionSlugForCustomerType,
  customerTypeDivisionError,
} from "./service-location";
import { billingMissing, isBillingComplete } from "./billing";

describe("service location lines", () => {
  it("forces commercial normalize to Integrated Systems only", () => {
    assert.deepEqual(
      normalizeServiceLines("COMMERCIAL", [
        "CABIN_SERVICES",
        "INTEGRATED_SYSTEMS",
      ]),
      ["INTEGRATED_SYSTEMS"],
    );
  });

  it("rejects commercial without Integrated Systems only", () => {
    assert.equal(
      validateServiceLines("COMMERCIAL", ["CABIN_SERVICES"]),
      "Commercial locations can only use Integrated Systems.",
    );
    assert.equal(
      validateServiceLines("COMMERCIAL", ["INTEGRATED_SYSTEMS"]),
      null,
    );
  });

  it("locks owning division from customer type", () => {
    assert.equal(
      owningDivisionSlugForCustomerType("COMMERCIAL"),
      "integrated-systems",
    );
    assert.equal(
      owningDivisionSlugForCustomerType("RESIDENTIAL"),
      "integrated-systems",
    );
    assert.equal(owningDivisionSlugForCustomerType("STR"), "cabin-services");
    assert.match(
      customerTypeDivisionError("COMMERCIAL", "cabin-services") ?? "",
      /Integrated Systems/,
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

  it("normalizes address keys for duplicate checks", () => {
    assert.equal(
      normalizeAddressKey({
        line1: "  12 Main St ",
        city: "Oak Ridge",
        region: "tn",
        postalCode: "37830",
      }),
      "12 main st|oak ridge|tn|37830",
    );
  });

  it("derives service location defaults from root org", () => {
    assert.deepEqual(
      rootOrgServiceLocationDefaults({
        customerType: "COMMERCIAL",
        divisionSlug: "integrated-systems",
      }),
      {
        classification: "COMMERCIAL",
        serviceLines: ["INTEGRATED_SYSTEMS"],
      },
    );
    assert.deepEqual(
      rootOrgServiceLocationDefaults({
        customerType: "STR",
        divisionSlug: "cabin-services",
      }),
      {
        classification: "RESIDENTIAL",
        serviceLines: ["CABIN_SERVICES"],
      },
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
