import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { phoneNat10 } from "@/lib/phone-parse";
import {
  activityTypeForPhoneKind,
  buildPhoneMatchDisplayMap,
  mergeBody,
  pickUniqueByNat,
} from "./match-target";

describe("activityTypeForPhoneKind", () => {
  it("maps SMS to SMS and call kinds to CALL", () => {
    assert.equal(activityTypeForPhoneKind("SMS"), "SMS");
    assert.equal(activityTypeForPhoneKind("CALL"), "CALL");
    assert.equal(activityTypeForPhoneKind("MISSED_CALL"), "CALL");
    assert.equal(activityTypeForPhoneKind("VOICEMAIL"), "CALL");
  });
});

describe("mergeBody", () => {
  it("appends unique lines", () => {
    assert.equal(mergeBody(null, "Missed call"), "Missed call");
    assert.equal(
      mergeBody("Missed call", "Summary: hi"),
      "Missed call\nSummary: hi",
    );
    assert.equal(mergeBody("Missed call", "Missed call"), "Missed call");
  });
});

describe("phoneNat10", () => {
  it("normalizes formatted US numbers for match index", () => {
    assert.equal(phoneNat10("(865) 555-1234"), "8655551234");
    assert.equal(phoneNat10("865-555-1234"), "8655551234");
    assert.equal(phoneNat10("+18655551234"), "8655551234");
  });

  it("does not alias international last-10 onto NANP", () => {
    // +49 30 55512345 → digits longer than 11; must not become 3055512345
    assert.equal(phoneNat10("+49 30 55512345"), null);
  });
});

describe("pickUniqueByNat", () => {
  it("returns the single match", () => {
    const row = pickUniqueByNat(
      "8655551234",
      [{ id: "c1" }],
      "contact",
      (r) => r.id,
    );
    assert.deepEqual(row, { id: "c1" });
  });

  it("returns null when two contacts share a number", () => {
    const row = pickUniqueByNat(
      "8655551234",
      [{ id: "c1" }, { id: "c2" }],
      "contact",
      (r) => r.id,
    );
    assert.equal(row, null);
  });
});

describe("buildPhoneMatchDisplayMap", () => {
  it("matches Call Log display the same way as unique contact/lead picks", () => {
    const map = buildPhoneMatchDisplayMap({
      contacts: [
        {
          directPhoneNat: "8655551234",
          customer: {
            id: "cust1",
            displayName: "Acme",
            division: { slug: "integrated-systems" },
          },
        },
      ],
      leads: [
        {
          id: "lead1",
          name: "Website Lead",
          phoneNat: "8655551234",
          orgDivision: { slug: "integrated-systems" },
        },
      ],
    });
    // Contact preferred over lead (same as matchPhoneTarget).
    assert.deepEqual(map.get("8655551234"), {
      kind: "customer",
      id: "cust1",
      name: "Acme",
      divisionSlug: "integrated-systems",
    });
  });

  it("leaves ambiguous numbers unmatched", () => {
    const map = buildPhoneMatchDisplayMap({
      contacts: [
        {
          directPhoneNat: "8655551234",
          customer: {
            id: "cust1",
            displayName: "A",
            division: { slug: "integrated-systems" },
          },
        },
        {
          directPhoneNat: "8655551234",
          customer: {
            id: "cust2",
            displayName: "B",
            division: { slug: "integrated-systems" },
          },
        },
      ],
      leads: [],
    });
    assert.equal(map.get("8655551234"), undefined);
  });

  it("matches a lead when no contact", () => {
    const map = buildPhoneMatchDisplayMap({
      contacts: [],
      leads: [
        {
          id: "lead1",
          name: "Formatted Lead",
          phoneNat: phoneNat10("(865) 555-1234"),
          orgDivision: { slug: "integrated-systems" },
        },
      ],
    });
    assert.deepEqual(map.get("8655551234"), {
      kind: "lead",
      id: "lead1",
      name: "Formatted Lead",
      divisionSlug: "integrated-systems",
    });
  });
});
