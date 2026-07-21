import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  buildExportWorkbookBuffer,
  parseDomainSheet,
  parseWorkbookBuffer,
  planImport,
  summarizePlan,
  type ExistingSnapshot,
  type ParsedWorkbook,
} from "./io";
import { normalizeName, nameMatchKey, slugify } from "./normalize";
import { parseScopeFromFilename, scopeCodeFor } from "./scope-code";

describe("normalizeName", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normalizeName("Card  Reader"), "Card Reader");
    assert.equal(normalizeName("Miscellaneous Materials "), "Miscellaneous Materials");
    assert.equal(
      nameMatchKey("Card  Reader"),
      nameMatchKey("card reader"),
    );
  });

  it("slugify uses cleaned name", () => {
    assert.equal(slugify("Card  Reader"), "card-reader");
  });
});

describe("scope-code", () => {
  it("derives IS_COM from division code + segment", () => {
    assert.equal(scopeCodeFor("IS", "COMMERCIAL"), "IS_COM");
  });

  it("parses catalog filename", () => {
    const parsed = parseScopeFromFilename("catalog_IS_COM_2026-07-08.xlsx");
    assert.ok(parsed);
    assert.equal(parsed!.scopeCode, "IS_COM");
    assert.equal(parsed!.segment, "COMMERCIAL");
    assert.equal(parsed!.date, "2026-07-08");
  });
});

describe("parseDomainSheet", () => {
  it("parses category blocks including empty categories", () => {
    const { categories, warnings } = parseDomainSheet("Access Control", [
      ["Card  Reader"],
      ["description", "unit", "laborUnits", "laborUnitNotes"],
      ["HID Reader  ", "EACH", "0.33", "mount"],
      [],
      ["Empty Cat"],
      ["description", "unit", "laborUnits", "laborUnitNotes"],
      [],
      ["Locks"],
      ["description", "unit", "laborUnits", "laborUnitNotes"],
      ["Mag lock", "EACH", "not-a-number", ""],
    ]);

    assert.equal(categories.length, 3);
    assert.equal(categories[0]!.name, "Card Reader");
    assert.equal(categories[0]!.items.length, 1);
    assert.equal(categories[0]!.items[0]!.name, "HID Reader");
    assert.equal(categories[0]!.items[0]!.laborUnits, 0.33);
    assert.equal(categories[1]!.name, "Empty Cat");
    assert.equal(categories[1]!.items.length, 0);
    assert.equal(categories[2]!.items[0]!.laborUnits, 0);
    assert.ok(warnings.some((w) => /Unparseable laborUnits/.test(w.message)));
  });
});

async function syntheticWorkbookBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ac = wb.addWorksheet("Access Control");
  ac.addRow(["Card  Reader"]);
  ac.addRow(["description", "unit", "laborUnits", "laborUnitNotes"]);
  ac.addRow(["Reader A", "EACH", "0.25", "note"]);
  ac.addRow([]);
  ac.addRow(["Locks"]);
  ac.addRow(["description", "unit", "laborUnits", "laborUnitNotes"]);
  ac.addRow(["Mag lock", "EACH", "0.5", ""]);

  const alarm = wb.addWorksheet("Alarm Systems");
  alarm.addRow(["Panels"]);
  alarm.addRow(["description", "unit", "laborUnits", "laborUnitNotes"]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("parseWorkbookBuffer + planImport", () => {
  it("plans creates from empty snapshot", async () => {
    const parsed = await parseWorkbookBuffer(await syntheticWorkbookBuffer());
    assert.equal(parsed.domains.length, 2);
    assert.equal(
      parsed.domains.reduce((n, d) => n + d.categories.length, 0),
      3,
    );
    assert.equal(
      parsed.domains.reduce(
        (n, d) => n + d.categories.reduce((m, c) => m + c.items.length, 0),
        0,
      ),
      2,
    );

    const empty: ExistingSnapshot = {
      units: [],
      domains: [],
      categories: [],
      items: [],
    };
    const plan = planImport(empty, parsed);
    const summary = summarizePlan(plan);
    assert.equal(parsed.layoutOk, true);
    assert.equal(summary.domainsCreated, 2);
    assert.equal(summary.categoriesCreated, 3);
    assert.equal(summary.unitsCreated, 1);
    assert.equal(summary.itemsCreated, 2);
    assert.equal(summary.itemsUpdated, 0);
  });

  it("re-plan is idempotent when snapshot matches file", async () => {
    const parsed = await parseWorkbookBuffer(await syntheticWorkbookBuffer());
    const snapshot = snapshotFromParsed(parsed);
    const plan = planImport(snapshot, parsed);
    const summary = summarizePlan(plan);
    assert.equal(summary.domainsCreated, 0);
    assert.equal(summary.categoriesCreated, 0);
    assert.equal(summary.unitsCreated, 0);
    assert.equal(summary.itemsCreated, 0);
    assert.equal(summary.itemsUpdated, 0);
    assert.equal(summary.itemsUnchanged, 2);
  });

  it("detects laborUnits update", async () => {
    const parsed = await parseWorkbookBuffer(await syntheticWorkbookBuffer());
    const snapshot = snapshotFromParsed(parsed);
    const item = snapshot.items.find((i) => i.name === "Mag lock")!;
    item.laborUnits = "0.1";

    const plan = planImport(snapshot, parsed);
    assert.equal(plan.itemUpdates.length, 1);
    assert.equal(plan.itemUpdates[0]!.name, "Mag lock");
    assert.equal(plan.itemUpdates[0]!.changes[0]!.field, "laborUnits");
    assert.equal(plan.itemCreates.length, 0);
    assert.equal(plan.unchangedItemCount, 1);
  });

  it("export then re-import yields zero changes", async () => {
    const parsed = await parseWorkbookBuffer(await syntheticWorkbookBuffer());
    const domains = parsed.domains.map((d, di) => ({
      name: d.name,
      sortOrder: di,
      categories: d.categories.map((c, ci) => ({
        name: c.name,
        sortOrder: ci,
        items: c.items.map((item) => ({
          name: item.name,
          unitCode: item.unitCode,
          laborUnits: String(item.laborUnits),
          laborUnitNotes: item.laborUnitNotes,
        })),
      })),
    }));
    const exported = await buildExportWorkbookBuffer(domains);
    const reparsed = await parseWorkbookBuffer(exported);
    const snapshot = snapshotFromParsed(parsed);
    const plan = planImport(snapshot, reparsed);
    const summary = summarizePlan(plan);
    assert.equal(summary.domainsCreated, 0);
    assert.equal(summary.categoriesCreated, 0);
    assert.equal(summary.itemsCreated, 0);
    assert.equal(summary.itemsUpdated, 0);
  });

  it("rejects attribute-lists-shaped workbook (no catalog headers)", async () => {
    const parsed = await parseWorkbookBuffer(
      await attributeListsShapedWorkbookBuffer(),
    );
    assert.equal(parsed.layoutOk, false);
    assert.equal(parsed.domains.length, 0);
    assert.equal(parsed.sheetsMatched, 0);
    assert.ok(parsed.sheetsTotal >= 2);
    assert.match(
      parsed.layoutMessage ?? "",
      /doesn't look like a materials catalog export/,
    );
    assert.ok(
      parsed.warnings.some((w) =>
        /doesn't match the catalog layout/.test(w.message),
      ),
    );

    const plan = planImport(
      { units: [], domains: [], categories: [], items: [] },
      parsed,
    );
    assert.equal(plan.layoutOk, false);
    assert.equal(plan.domainCreates.length, 0);
    assert.equal(plan.categoryCreates.length, 0);
    assert.equal(plan.itemCreates.length, 0);
  });

  it("parses item tax columns and plans blank→null / invalid skip", async () => {
    const wb = new ExcelJS.Workbook();
    const ac = wb.addWorksheet("Access Control");
    ac.addRow(["Card Reader"]);
    ac.addRow([
      "description",
      "unit",
      "laborUnits",
      "laborUnitNotes",
      "stripeTaxCodeId",
      "laborInstallTaxCodeId",
      "laborServiceTaxCodeId",
    ]);
    ac.addRow(["Reader A", "EACH", "0.25", "", "txcd_99999999", "", ""]);
    ac.addRow(["Reader B", "EACH", "0.1", "", "txcd_bogus", "txcd_20020010", ""]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseWorkbookBuffer(buffer);
    assert.equal(parsed.domains[0]!.categories[0]!.items[0]!.stripeTaxCodeId, "txcd_99999999");
    assert.equal(parsed.domains[0]!.categories[0]!.items[0]!.laborInstallTaxCodeId, null);

    const snapshot: ExistingSnapshot = {
      units: [{ id: "u1", code: "EACH" }],
      domains: [
        {
          id: "d1",
          name: "Access Control",
          slug: "access-control",
          sortOrder: 0,
        },
      ],
      categories: [
        {
          id: "c1",
          domainId: "d1",
          domainSlug: "access-control",
          name: "Card Reader",
          slug: "card-reader",
          sortOrder: 0,
        },
      ],
      items: [
        {
          id: "i1",
          categoryId: "c1",
          domainSlug: "access-control",
          categorySlug: "card-reader",
          name: "Reader A",
          unitCode: "EACH",
          laborUnits: "0.25",
          laborUnitNotes: null,
          stripeTaxCodeId: null,
          laborInstallTaxCodeId: "txcd_20020010",
          laborServiceTaxCodeId: null,
        },
        {
          id: "i2",
          categoryId: "c1",
          domainSlug: "access-control",
          categorySlug: "card-reader",
          name: "Reader B",
          unitCode: "EACH",
          laborUnits: "0.1",
          laborUnitNotes: null,
          stripeTaxCodeId: "txcd_99999999",
          laborInstallTaxCodeId: null,
          laborServiceTaxCodeId: null,
        },
      ],
      validTaxCodeIds: new Set(["txcd_99999999", "txcd_20020010"]),
    };
    const plan = planImport(snapshot, parsed);
    const a = plan.itemUpdates.find((u) => u.name === "Reader A")!;
    assert.ok(a);
    assert.equal(a.stripeTaxCodeId, "txcd_99999999");
    assert.equal(a.laborInstallTaxCodeId, null); // blank clears
    const b = plan.itemUpdates.find((u) => u.name === "Reader B");
    // bogus stripe skipped; install set; may still update
    assert.ok(plan.warnings.some((w) => /Unknown stripeTaxCodeId/.test(w.message)));
    assert.ok(b);
    assert.equal(b!.stripeTaxCodeId, undefined); // invalid not applied
    assert.equal(b!.laborInstallTaxCodeId, "txcd_20020010");
  });

  it("legacy headers without tax columns leave tax overrides untouched", async () => {
    const parsed = await parseWorkbookBuffer(await syntheticWorkbookBuffer());
    const snapshot = snapshotFromParsed(parsed);
    snapshot.items[0]!.stripeTaxCodeId = "txcd_99999999";
    snapshot.validTaxCodeIds = new Set(["txcd_99999999"]);
    const plan = planImport(snapshot, parsed);
    assert.equal(plan.itemUpdates.length, 0);
    assert.equal(plan.unchangedItemCount, 2);
  });
});

async function attributeListsShapedWorkbookBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const index = wb.addWorksheet("Attribute Lists");
  index.addRow(["list_key", "list_name", "filter_mode"]);
  index.addRow(["color", "Color", "FACET"]);
  index.addRow(["vendor", "Vendor", "DOMAIN"]);

  const color = wb.addWorksheet("color");
  color.addRow(["label", "sort_order", "tags", "rfq_contact", "rfq_email"]);
  color.addRow(["Black", 2, "jacket_color", "", ""]);

  const vendor = wb.addWorksheet("vendor");
  vendor.addRow(["label", "sort_order", "tags", "rfq_contact", "rfq_email"]);
  vendor.addRow(["Acme", 1, "", "", ""]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function snapshotFromParsed(parsed: ParsedWorkbook): ExistingSnapshot {
  const units = new Map<string, { id: string; code: string }>();
  const domains: ExistingSnapshot["domains"] = [];
  const categories: ExistingSnapshot["categories"] = [];
  const items: ExistingSnapshot["items"] = [];

  parsed.domains.forEach((d, di) => {
    const domainId = `d${di}`;
    const domainSlug = slugify(d.name);
    domains.push({
      id: domainId,
      name: d.name,
      slug: domainSlug,
      sortOrder: di,
    });
    d.categories.forEach((c, ci) => {
      const categoryId = `c${di}_${ci}`;
      const categorySlug = slugify(c.name);
      categories.push({
        id: categoryId,
        domainId,
        domainSlug,
        name: c.name,
        slug: categorySlug,
        sortOrder: ci,
      });
      c.items.forEach((item, ii) => {
        const code = item.unitCode.toUpperCase();
        if (!units.has(code)) {
          units.set(code, { id: `u_${code}`, code });
        }
        items.push({
          id: `i${di}_${ci}_${ii}`,
          categoryId,
          domainSlug,
          categorySlug,
          name: item.name,
          unitCode: code,
          laborUnits: String(item.laborUnits),
          laborUnitNotes: item.laborUnitNotes,
          stripeTaxCodeId: item.stripeTaxCodeId ?? null,
          laborInstallTaxCodeId: item.laborInstallTaxCodeId ?? null,
          laborServiceTaxCodeId: item.laborServiceTaxCodeId ?? null,
        });
      });
    });
  });

  return {
    units: [...units.values()],
    domains,
    categories,
    items,
  };
}
