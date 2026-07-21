import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listCustomerScopes,
  listScopeCodes,
  resolveStorageScope,
} from "./scope-code";

describe("resolveStorageScope", () => {
  it("IS Commercial is identity (not shared)", () => {
    const r = resolveStorageScope("integrated-systems", "COMMERCIAL");
    assert.equal(r.storageSegment, "COMMERCIAL");
    assert.equal(r.customerSegment, "COMMERCIAL");
    assert.equal(r.shared, false);
    assert.equal(r.scopeCode, "IS_COM");
  });

  it("IS Residential is identity", () => {
    const r = resolveStorageScope("integrated-systems", "RESIDENTIAL");
    assert.equal(r.storageSegment, "RESIDENTIAL");
    assert.equal(r.scopeCode, "IS_RES");
    assert.equal(r.shared, false);
  });

  it("CS STR and CS Residential both store as STR and share", () => {
    const str = resolveStorageScope("cabin-services", "STR");
    const res = resolveStorageScope("cabin-services", "RESIDENTIAL");
    assert.equal(str.storageSegment, "STR");
    assert.equal(res.storageSegment, "STR");
    assert.equal(str.shared, true);
    assert.equal(res.shared, true);
    assert.equal(str.scopeCode, "CS_STR");
    assert.equal(res.scopeCode, "CS_RES");
  });

  it("rejects Cabin Services + COMMERCIAL", () => {
    assert.throws(
      () => resolveStorageScope("cabin-services", "COMMERCIAL"),
      /not valid/,
    );
  });
});

describe("listScopeCodes / listCustomerScopes", () => {
  it("includes CS_STR and CS_RES with shared storage STR", () => {
    const codes = listScopeCodes();
    const csStr = codes.find((c) => c.code === "CS_STR");
    const csRes = codes.find((c) => c.code === "CS_RES");
    assert.ok(csStr);
    assert.ok(csRes);
    assert.equal(csStr!.storageSegment, "STR");
    assert.equal(csRes!.storageSegment, "STR");
    assert.equal(csStr!.shared, true);
    assert.equal(csRes!.shared, true);
  });

  it("does not invent CS_COM", () => {
    assert.equal(
      listCustomerScopes().some((s) => s.scopeCode === "CS_COM"),
      false,
    );
  });
});
