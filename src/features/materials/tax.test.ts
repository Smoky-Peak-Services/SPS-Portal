import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANONICAL_LABOR_TAX_DEFAULTS,
  deriveTaxProfileFromStripeCode,
  NONTAXABLE_TAX_CODE_ID,
  PARTS_SALE_TAX_CODE_ID,
  resolveItemTaxClassification,
  resolveLaborTaxCode,
  resolveMaterialStripeTaxCode,
} from "./tax";

describe("deriveTaxProfileFromStripeCode", () => {
  it("nontaxable and null → REAL_PROPERTY", () => {
    assert.equal(deriveTaxProfileFromStripeCode(null), "REAL_PROPERTY");
    assert.equal(deriveTaxProfileFromStripeCode(""), "REAL_PROPERTY");
    assert.equal(
      deriveTaxProfileFromStripeCode(NONTAXABLE_TAX_CODE_ID),
      "REAL_PROPERTY",
    );
  });

  it("any other code → TPP", () => {
    assert.equal(deriveTaxProfileFromStripeCode(PARTS_SALE_TAX_CODE_ID), "TPP");
    assert.equal(deriveTaxProfileFromStripeCode("txcd_20020010"), "TPP");
  });
});

describe("resolveItemTaxClassification", () => {
  it("derives profile from item material code", () => {
    const r = resolveItemTaxClassification(
      { stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID },
      { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID },
    );
    assert.equal(r.taxProfile, "TPP");
    assert.equal(r.stripeTaxCodeId, PARTS_SALE_TAX_CODE_ID);
    assert.equal(r.inheritedFrom, "item");
  });

  it("inherits category code and derives REAL_PROPERTY for nontaxable", () => {
    const r = resolveItemTaxClassification(
      { stripeTaxCodeId: null },
      { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID },
    );
    assert.equal(r.taxProfile, "REAL_PROPERTY");
    assert.equal(r.stripeTaxCodeId, NONTAXABLE_TAX_CODE_ID);
    assert.equal(r.inheritedFrom, "category");
  });

  it("never invents a code; unset → REAL_PROPERTY", () => {
    const r = resolveItemTaxClassification(
      { stripeTaxCodeId: null },
      { stripeTaxCodeId: null },
    );
    assert.equal(r.stripeTaxCodeId, null);
    assert.equal(r.taxProfile, "REAL_PROPERTY");
  });

  it("ignores stored taxProfile fields (code is source of truth)", () => {
    const r = resolveItemTaxClassification(
      { taxProfile: "TPP", stripeTaxCodeId: null },
      { taxProfile: "TPP", stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID },
    );
    assert.equal(r.taxProfile, "REAL_PROPERTY");
    assert.equal(r.stripeTaxCodeId, NONTAXABLE_TAX_CODE_ID);
  });
});

describe("resolveMaterialStripeTaxCode", () => {
  it("PARTS always uses General Tangible Goods", () => {
    const r = resolveMaterialStripeTaxCode({
      saleType: "PARTS",
      item: { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID },
      category: { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID },
    });
    assert.equal(r.stripeTaxCodeId, PARTS_SALE_TAX_CODE_ID);
    assert.equal(r.taxProfile, "TPP");
    assert.equal(r.inheritedFrom, "parts");
  });

  it("INSTALL_JOB uses item→category inheritance", () => {
    const r = resolveMaterialStripeTaxCode({
      saleType: "INSTALL_JOB",
      item: { stripeTaxCodeId: null },
      category: { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID },
    });
    assert.equal(r.stripeTaxCodeId, NONTAXABLE_TAX_CODE_ID);
    assert.equal(r.taxProfile, "REAL_PROPERTY");
    assert.equal(r.inheritedFrom, "category");
  });
});

describe("resolveLaborTaxCode 4-cell matrix", () => {
  const defaults = CANONICAL_LABOR_TAX_DEFAULTS;

  it("REAL_PROPERTY × INSTALL / SERVICE (nontaxable / unset code)", () => {
    const item = { stripeTaxCodeId: null };
    const category = { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID };
    assert.equal(
      resolveLaborTaxCode(item, category, "INSTALL", defaults).stripeTaxCodeId,
      "txcd_20020010",
    );
    assert.equal(
      resolveLaborTaxCode(item, category, "SERVICE", defaults).stripeTaxCodeId,
      "txcd_20080007",
    );
  });

  it("TPP × INSTALL / SERVICE (non-nontaxable material code)", () => {
    const item = { stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID };
    const category = { stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID };
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
      stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID,
      laborServiceTaxCodeId: "txcd_20080010",
    };
    const category = { stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID };
    const r = resolveLaborTaxCode(item, category, "SERVICE", defaults);
    assert.equal(r.stripeTaxCodeId, "txcd_20080010");
    assert.equal(r.inheritedFrom, "item");
  });

  it("category laborService override applies to SERVICE", () => {
    const installCode = "txcd_20020010";
    const item = { stripeTaxCodeId: null };
    const category = {
      stripeTaxCodeId: NONTAXABLE_TAX_CODE_ID,
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
    const item = { stripeTaxCodeId: null };
    const category = { stripeTaxCodeId: null };
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
