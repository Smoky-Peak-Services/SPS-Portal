import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANONICAL_LABOR_TAX_DEFAULTS,
  resolveItemTaxClassification,
  resolveLaborTaxCode,
} from "./tax";

describe("resolveItemTaxClassification", () => {
  it("uses item override then category", () => {
    const r = resolveItemTaxClassification(
      { taxProfile: "TPP", stripeTaxCodeId: "txcd_item" },
      { taxProfile: "REAL_PROPERTY", stripeTaxCodeId: "txcd_cat" },
    );
    assert.equal(r.taxProfile, "TPP");
    assert.equal(r.stripeTaxCodeId, "txcd_item");
    assert.equal(r.inheritedFrom, "item");
  });

  it("inherits category when item blank", () => {
    const r = resolveItemTaxClassification(
      { taxProfile: null, stripeTaxCodeId: null },
      { taxProfile: "REAL_PROPERTY", stripeTaxCodeId: "txcd_cat" },
    );
    assert.equal(r.taxProfile, "REAL_PROPERTY");
    assert.equal(r.stripeTaxCodeId, "txcd_cat");
    assert.equal(r.inheritedFrom, "category");
  });

  it("never invents a code", () => {
    const r = resolveItemTaxClassification(
      { taxProfile: null, stripeTaxCodeId: null },
      { taxProfile: "REAL_PROPERTY", stripeTaxCodeId: null },
    );
    assert.equal(r.stripeTaxCodeId, null);
    assert.equal(r.taxProfile, "REAL_PROPERTY");
  });
});

describe("resolveLaborTaxCode 4-cell matrix", () => {
  const defaults = CANONICAL_LABOR_TAX_DEFAULTS;

  it("REAL_PROPERTY × INSTALL / SERVICE", () => {
    const item = { taxProfile: null, stripeTaxCodeId: null };
    const category = {
      taxProfile: "REAL_PROPERTY" as const,
      stripeTaxCodeId: null,
    };
    assert.equal(
      resolveLaborTaxCode(item, category, "INSTALL", defaults).stripeTaxCodeId,
      "txcd_20020010",
    );
    assert.equal(
      resolveLaborTaxCode(item, category, "SERVICE", defaults).stripeTaxCodeId,
      "txcd_20080007",
    );
  });

  it("TPP × INSTALL / SERVICE", () => {
    const item = { taxProfile: "TPP" as const, stripeTaxCodeId: null };
    const category = {
      taxProfile: "REAL_PROPERTY" as const,
      stripeTaxCodeId: null,
    };
    assert.equal(
      resolveLaborTaxCode(item, category, "INSTALL", defaults).stripeTaxCodeId,
      "txcd_20020018",
    );
    assert.equal(
      resolveLaborTaxCode(item, category, "SERVICE", defaults).stripeTaxCodeId,
      "txcd_20080005",
    );
  });

  it("item labor override wins over default", () => {
    const item = {
      taxProfile: "TPP" as const,
      stripeTaxCodeId: null,
      laborServiceTaxCodeId: "txcd_20080010",
    };
    const category = {
      taxProfile: "TPP" as const,
      stripeTaxCodeId: null,
    };
    const r = resolveLaborTaxCode(item, category, "SERVICE", defaults);
    assert.equal(r.stripeTaxCodeId, "txcd_20080010");
    assert.equal(r.inheritedFrom, "item");
  });

  it("category laborService override applies to SERVICE (e.g. cabling always install)", () => {
    const installCode = "txcd_20020010";
    const item = { taxProfile: null, stripeTaxCodeId: null };
    const category = {
      taxProfile: "REAL_PROPERTY" as const,
      stripeTaxCodeId: null,
      laborServiceTaxCodeId: installCode,
    };
    assert.equal(
      resolveLaborTaxCode(item, category, "INSTALL", defaults).stripeTaxCodeId,
      installCode,
    );
    const service = resolveLaborTaxCode(item, category, "SERVICE", defaults);
    assert.equal(service.stripeTaxCodeId, installCode);
    assert.equal(service.inheritedFrom, "category");
  });

  it("category with no labor override still uses defaults", () => {
    const item = { taxProfile: null, stripeTaxCodeId: null };
    const category = {
      taxProfile: "REAL_PROPERTY" as const,
      stripeTaxCodeId: null,
    };
    assert.equal(
      resolveLaborTaxCode(item, category, "INSTALL", defaults).inheritedFrom,
      "default",
    );
    assert.equal(
      resolveLaborTaxCode(item, category, "SERVICE", defaults).stripeTaxCodeId,
      "txcd_20080007",
    );
  });
});
