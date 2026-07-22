import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  composeMessage,
  normalizeLeadBody,
  peelLegacyMessage,
  resolveCompany,
} from "./lead-handler";

describe("resolveCompany", () => {
  it("defaults blank to Residential", () => {
    assert.equal(resolveCompany(undefined), "Residential");
    assert.equal(resolveCompany(""), "Residential");
    assert.equal(resolveCompany("  "), "Residential");
  });

  it("keeps provided company", () => {
    assert.equal(resolveCompany("Acme LLC"), "Acme LLC");
    assert.equal(resolveCompany("  Acme  "), "Acme");
  });
});

describe("composeMessage", () => {
  it("folds subject into message", () => {
    assert.equal(composeMessage("Hi", "Body"), "Hi\n\nBody");
    assert.equal(composeMessage("Hi", undefined), "Hi");
    assert.equal(composeMessage(undefined, "Body"), "Body");
    assert.equal(composeMessage(undefined, undefined), null);
  });
});

describe("peelLegacyMessage", () => {
  it("extracts Company/Division/Subject prefixes", () => {
    const peeled = peelLegacyMessage(
      "Company: Acme\nDivision: General Inquiry\nSubject: Test\n\nhello",
    );
    assert.deepEqual(peeled, {
      company: "Acme",
      division: "General Inquiry",
      subject: "Test",
      message: "hello",
    });
  });
});

describe("normalizeLeadBody", () => {
  it("maps division aliases", () => {
    const out = normalizeLeadBody({
      name: "A",
      inquiryType: "General Inquiry",
    }) as Record<string, unknown>;
    assert.equal(out.division, "General Inquiry");
  });

  it("peels legacy message when fields missing", () => {
    const out = normalizeLeadBody({
      name: "A",
      message: "Division: Parent company / general inquiry\n\nCall me",
    }) as Record<string, unknown>;
    assert.equal(out.division, "Parent company / general inquiry");
    assert.equal(out.message, "Call me");
  });
});
