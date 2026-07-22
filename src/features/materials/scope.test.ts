import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listCustomerScopes, listScopeCodes, resolveScope } from "./scope-code";

describe("resolveScope", () => {
  it("IS Commercial resolves", () => {
    const r = resolveScope("integrated-systems", "COMMERCIAL");
    assert.equal(r.segment, "COMMERCIAL");
    assert.equal(r.scopeCode, "IS_COM");
  });

  it("IS Residential resolves", () => {
    const r = resolveScope("integrated-systems", "RESIDENTIAL");
    assert.equal(r.segment, "RESIDENTIAL");
    assert.equal(r.scopeCode, "IS_RES");
  });

  it("Cabin Services is a single STR scope", () => {
    const r = resolveScope("cabin-services", "STR");
    assert.equal(r.segment, "STR");
    assert.equal(r.scopeCode, "CS_STR");
  });

  it("rejects Cabin Services + RESIDENTIAL (no STR/RESI split)", () => {
    assert.throws(
      () => resolveScope("cabin-services", "RESIDENTIAL"),
      /not valid/,
    );
  });

  it("rejects Cabin Services + COMMERCIAL", () => {
    assert.throws(
      () => resolveScope("cabin-services", "COMMERCIAL"),
      /not valid/,
    );
  });
});

describe("listScopeCodes / listCustomerScopes", () => {
  it("exposes exactly the three scopes", () => {
    const codes = listScopeCodes().map((c) => c.code);
    assert.deepEqual(codes.sort(), ["CS_STR", "IS_COM", "IS_RES"]);
  });

  it("does not invent CS_RES or CS_COM", () => {
    const codes = listCustomerScopes().map((s) => s.scopeCode);
    assert.equal(codes.includes("CS_RES"), false);
    assert.equal(codes.includes("CS_COM"), false);
  });
});
