import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCategoryTaxExportAoa,
  parseCategoryTaxAoa,
  planCategoryTaxImport,
  type ExistingCategoryTaxSnapshot,
} from "./category-tax-io";
import { NONTAXABLE_TAX_CODE_ID, PARTS_SALE_TAX_CODE_ID } from "./tax";

function snapshot(
  overrides?: Partial<ExistingCategoryTaxSnapshot>,
): ExistingCategoryTaxSnapshot {
  return {
    categories: [
      {
        id: "cat-1",
        domainId: "dom-1",
        domainName: "Access Control",
        domainSlug: "access-control",
        name: "Card Reader",
        slug: "card-reader",
        taxProfile: "REAL_PROPERTY",
        taxReviewed: false,
        stripeTaxCodeId: null,
        laborInstallTaxCodeId: "txcd_20020010",
        laborServiceTaxCodeId: null,
      },
      {
        id: "cat-2",
        domainId: "dom-1",
        domainName: "Access Control",
        domainSlug: "access-control",
        name: "Locks",
        slug: "locks",
        taxProfile: "TPP",
        taxReviewed: true,
        stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID,
        laborInstallTaxCodeId: null,
        laborServiceTaxCodeId: null,
      },
    ],
    validTaxCodeIds: new Set([
      NONTAXABLE_TAX_CODE_ID,
      PARTS_SALE_TAX_CODE_ID,
      "txcd_20020010",
      "txcd_20060050",
    ]),
    ...overrides,
  };
}

describe("parseCategoryTaxAoa", () => {
  it("requires domain and category headers", () => {
    const parsed = parseCategoryTaxAoa([["foo", "bar"]]);
    assert.equal(parsed.layoutOk, false);
  });

  it("parses data rows", () => {
    const aoa = buildCategoryTaxExportAoa([
      {
        domain: "Access Control",
        category: "Card Reader",
        slug: "card-reader",
        taxProfile: "REAL_PROPERTY",
        taxReviewed: true,
        stripeTaxCodeId: PARTS_SALE_TAX_CODE_ID,
        stripeTaxCodeName: "Goods",
        laborInstallTaxCodeId: null,
        laborInstallTaxCodeName: null,
        laborServiceTaxCodeId: null,
        laborServiceTaxCodeName: null,
      },
    ]);
    const parsed = parseCategoryTaxAoa(aoa);
    assert.equal(parsed.layoutOk, true);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0]!.domain, "Access Control");
    assert.equal(parsed.rows[0]!.stripeTaxCodeId, PARTS_SALE_TAX_CODE_ID);
    assert.equal(parsed.rows[0]!.laborInstallTaxCodeId, "");
  });
});

describe("planCategoryTaxImport", () => {
  it("matches by domain+category and never creates", () => {
    const existing = snapshot();
    const parsed = parseCategoryTaxAoa([
      [
        "domain",
        "category",
        "taxReviewed",
        "stripeTaxCodeId",
        "laborInstallTaxCodeId",
        "laborServiceTaxCodeId",
      ],
      ["Access Control", "Card Reader", "true", PARTS_SALE_TAX_CODE_ID, "", ""],
      ["No Domain", "Ghost Cat", "true", "", "", ""],
    ]);
    const plan = planCategoryTaxImport(existing, parsed);
    assert.equal(plan.unresolved.length, 1);
    assert.equal(plan.updates.length, 1);
    const u = plan.updates[0]!;
    assert.equal(u.id, "cat-1");
    assert.equal(u.taxReviewed, true);
    assert.equal(u.stripeTaxCodeId, PARTS_SALE_TAX_CODE_ID);
    assert.equal(u.laborInstallTaxCodeId, null); // blank clears
    assert.equal(u.taxProfile, "TPP"); // derived from parts code
  });

  it("blank labor clears override; null round-trip is unchanged", () => {
    const existing = snapshot();
    const parsed = parseCategoryTaxAoa([
      [
        "domain",
        "category",
        "taxReviewed",
        "stripeTaxCodeId",
        "laborInstallTaxCodeId",
        "laborServiceTaxCodeId",
      ],
      // Locks already has null labor — blank stays null → no labor change
      ["Access Control", "Locks", "true", PARTS_SALE_TAX_CODE_ID, "", ""],
    ]);
    const plan = planCategoryTaxImport(existing, parsed);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unchangedCount, 1);
  });

  it("invalid code is flagged and left unchanged", () => {
    const existing = snapshot();
    const parsed = parseCategoryTaxAoa([
      [
        "domain",
        "category",
        "taxReviewed",
        "stripeTaxCodeId",
        "laborInstallTaxCodeId",
        "laborServiceTaxCodeId",
      ],
      [
        "Access Control",
        "Card Reader",
        "false",
        "txcd_does_not_exist",
        "txcd_20020010",
        "",
      ],
    ]);
    const plan = planCategoryTaxImport(existing, parsed);
    const u = plan.updates.find((x) => x.id === "cat-1");
    // stripe invalid → not applied; labor stays same (no change); taxReviewed same
    // labor blank would clear — wait, labor is "txcd_20020010" which matches existing
    // service blank → null which matches existing null
    // taxReviewed false matches existing false
    // So only warning about invalid stripe, no updates
    assert.ok(
      plan.warnings.some((w) => /Unknown stripeTaxCodeId/.test(w.message)),
    );
    assert.equal(u, undefined);
    assert.equal(plan.unchangedCount, 1);
  });

  it("taxReviewed blank leaves and warns", () => {
    const existing = snapshot();
    const parsed = parseCategoryTaxAoa([
      [
        "domain",
        "category",
        "taxReviewed",
        "stripeTaxCodeId",
        "laborInstallTaxCodeId",
        "laborServiceTaxCodeId",
      ],
      ["Access Control", "Card Reader", "", "", "txcd_20020010", ""],
    ]);
    const plan = planCategoryTaxImport(existing, parsed);
    assert.ok(plan.warnings.some((w) => /taxReviewed blank/.test(w.message)));
    // blank stripe → null (was null) — no change; labor same
    assert.equal(plan.updates.length, 0);
  });

  it("derives taxProfile after stripeTaxCodeId write", () => {
    const existing = snapshot();
    const parsed = parseCategoryTaxAoa([
      [
        "domain",
        "category",
        "taxReviewed",
        "stripeTaxCodeId",
        "laborInstallTaxCodeId",
        "laborServiceTaxCodeId",
      ],
      ["Access Control", "Locks", "true", NONTAXABLE_TAX_CODE_ID, "", ""],
    ]);
    const plan = planCategoryTaxImport(existing, parsed);
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0]!.stripeTaxCodeId, NONTAXABLE_TAX_CODE_ID);
    assert.equal(plan.updates[0]!.taxProfile, "REAL_PROPERTY");
    assert.ok(plan.updates[0]!.changes.some((c) => c.field === "taxProfile"));
  });

  it("matches via slug fallback", () => {
    const existing = snapshot();
    const parsed = parseCategoryTaxAoa([
      [
        "domain",
        "category",
        "taxReviewed",
        "stripeTaxCodeId",
        "laborInstallTaxCodeId",
        "laborServiceTaxCodeId",
      ],
      ["access-control", "card-reader", "true", "", "txcd_20020010", ""],
    ]);
    const plan = planCategoryTaxImport(existing, parsed);
    assert.equal(plan.unresolved.length, 0);
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0]!.taxReviewed, true);
  });
});
