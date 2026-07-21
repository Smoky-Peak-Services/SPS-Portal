import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  decodeActiveScopeCookie,
  encodeActiveScopeCookie,
  resolveActiveScope,
  type ScopeDivision,
} from "./active-scope";

const IS: ScopeDivision = {
  id: "div-is",
  name: "Integrated Systems",
  slug: "integrated-systems",
};
const CABIN: ScopeDivision = {
  id: "div-cabin",
  name: "Cabin Services",
  slug: "cabin-services",
};
const DIVISIONS = [CABIN, IS];

describe("active-scope cookie", () => {
  it("round-trips slug + segment", () => {
    const encoded = encodeActiveScopeCookie(
      "integrated-systems",
      "RESIDENTIAL",
    );
    assert.equal(encoded, "integrated-systems:RESIDENTIAL");
    assert.deepEqual(decodeActiveScopeCookie(encoded), {
      divisionSlug: "integrated-systems",
      segment: "RESIDENTIAL",
    });
  });

  it("rejects malformed values", () => {
    assert.equal(decodeActiveScopeCookie(null), null);
    assert.equal(decodeActiveScopeCookie(""), null);
    assert.equal(decodeActiveScopeCookie("no-separator"), null);
    assert.equal(decodeActiveScopeCookie(":COMMERCIAL"), null);
    assert.equal(decodeActiveScopeCookie("integrated-systems:BOGUS"), null);
  });
});

describe("resolveActiveScope", () => {
  it("URL wins over cookie", () => {
    const scope = resolveActiveScope({
      divisions: DIVISIONS,
      url: { divisionId: "div-cabin", segment: "STR" },
      cookie: "integrated-systems:COMMERCIAL",
    });
    assert.equal(scope?.divisionId, "div-cabin");
    assert.equal(scope?.segment, "STR");
    assert.equal(scope?.scopeCode, "CS_STR");
  });

  it("invalid URL divisionId falls through to cookie", () => {
    const scope = resolveActiveScope({
      divisions: DIVISIONS,
      url: { divisionId: "div-unknown", segment: "STR" },
      cookie: "integrated-systems:RESIDENTIAL",
    });
    assert.equal(scope?.divisionId, "div-is");
    assert.equal(scope?.segment, "RESIDENTIAL");
    assert.equal(scope?.scopeCode, "IS_RES");
  });

  it("URL segment invalid for the division falls back to first valid segment", () => {
    const scope = resolveActiveScope({
      divisions: DIVISIONS,
      url: { divisionId: "div-cabin", segment: "COMMERCIAL" },
      cookie: null,
    });
    assert.equal(scope?.divisionId, "div-cabin");
    assert.equal(scope?.segment, "STR");
  });

  it("cookie parses when no URL scope is present", () => {
    const scope = resolveActiveScope({
      divisions: DIVISIONS,
      cookie: "cabin-services:STR",
    });
    assert.equal(scope?.divisionId, "div-cabin");
    assert.equal(scope?.scopeCode, "CS_STR");
  });

  it("cookie with an invalid segment for its division is ignored", () => {
    const scope = resolveActiveScope({
      divisions: DIVISIONS,
      cookie: "cabin-services:COMMERCIAL",
    });
    assert.equal(scope?.divisionId, "div-is");
    assert.equal(scope?.segment, "COMMERCIAL");
  });

  it("defaults to Integrated Systems / COMMERCIAL", () => {
    const scope = resolveActiveScope({ divisions: DIVISIONS });
    assert.equal(scope?.divisionId, "div-is");
    assert.equal(scope?.segment, "COMMERCIAL");
    assert.equal(scope?.scopeCode, "IS_COM");
  });

  it("fallback beats default but loses to URL and cookie", () => {
    const viaFallback = resolveActiveScope({
      divisions: DIVISIONS,
      fallback: { divisionSlug: "cabin-services", segment: "STR" },
    });
    assert.equal(viaFallback?.divisionId, "div-cabin");

    const cookieWins = resolveActiveScope({
      divisions: DIVISIONS,
      cookie: "integrated-systems:RESIDENTIAL",
      fallback: { divisionSlug: "cabin-services", segment: "STR" },
    });
    assert.equal(cookieWins?.divisionId, "div-is");
    assert.equal(cookieWins?.segment, "RESIDENTIAL");
  });

  it("Cabin is a single scope (STR only)", () => {
    const scope = resolveActiveScope({
      divisions: [CABIN],
      url: { divisionId: "div-cabin", segment: "RESIDENTIAL" },
    });
    assert.equal(scope?.segment, "STR");
    assert.equal(scope?.scopeCode, "CS_STR");
  });

  it("returns null when no divisions exist", () => {
    assert.equal(resolveActiveScope({ divisions: [] }), null);
  });
});
