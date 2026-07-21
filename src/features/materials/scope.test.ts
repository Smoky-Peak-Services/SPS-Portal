import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listCustomerScopes,
  listScopeCodes,
  resolveStorageScope,
} from "./scope-code";

describe("resolveStorageScope", () => {
  it("IS Commercial is identity", () => {
    const r = resolveStorageScope("integrated-systems", "COMMERCIAL");
    assert.equal(r.storageSegment, "COMMERCIAL");
    assert.equal(r.customerSegment, "COMMERCIAL");
    assert.equal(r.scopeCode, "IS_COM");
  });

  it("IS Residential is identity", () => {
    const r = resolveStorageScope("integrated-systems", "RESIDENTIAL");
    assert.equal(r.storageSegment, "RESIDENTIAL");
    assert.equal(r.scopeCode, "IS_RES");
  });

  it("Cabin Services is a single STR scope", () => {
    const r = resolveStorageScope("cabin-services", "STR");
    assert.equal(r.storageSegment, "STR");
    assert.equal(r.scopeCode, "CS_STR");
  });

  it("rejects Cabin Services + RESIDENTIAL (no STR/RESI split)", () => {
    assert.throws(
      () => resolveStorageScope("cabin-services", "RESIDENTIAL"),
      /not valid/,
    );
  });

  it("rejects Cabin Services + COMMERCIAL", () => {
    assert.throws(
      () => resolveStorageScope("cabin-services", "COMMERCIAL"),
      /not valid/,
    );
  });
});

describe("listScopeCodes / listCustomerScopes", () => {
  it("exposes exactly the three scopes", () => {
    const codes = listScopeCodes().map((c) => c.code);
    assert.deepEqual(codes.sort(), ["CS_STR", "IS_COM", "IS_RES"]);
  });

  it("storage always equals the segment", () => {
    for (const s of listCustomerScopes()) {
      assert.equal(s.storageSegment, s.customerSegment);
    }
  });

  it("does not invent CS_RES or CS_COM", () => {
    const codes = listCustomerScopes().map((s) => s.scopeCode);
    assert.equal(codes.includes("CS_RES"), false);
    assert.equal(codes.includes("CS_COM"), false);
  });
});
