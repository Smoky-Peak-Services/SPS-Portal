import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  buildAttributeExportWorkbookBuffer,
  parseAttributeWorkbookBuffer,
  planAttributeImport,
  summarizeAttributePlan,
  type ExistingAttributeSnapshot,
  type ParsedAttributeWorkbook,
} from "./attribute-io";

async function syntheticAttributeListsBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const index = wb.addWorksheet("Attribute Lists");
  index.addRow(["list_key", "list_name", "filter_mode"]);
  index.addRow(["color", "Color", "FACET"]);
  index.addRow(["vendor", "Vendor", "DOMAIN"]);

  const color = wb.addWorksheet("color");
  color.addRow(["label", "sort_order", "tags", "rfq_contact", "rfq_email"]);
  color.addRow(["Black", 2, "jacket_color", "", ""]);
  color.addRow(["White", 1, "", "", ""]);

  const vendor = wb.addWorksheet("vendor");
  vendor.addRow(["label", "sort_order", "tags", "rfq_contact", "rfq_email"]);
  vendor.addRow(["Acme", 1, "", "", ""]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function catalogShapedBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ac = wb.addWorksheet("Access Control");
  ac.addRow(["Locks"]);
  ac.addRow(["description", "unit", "laborUnits", "laborUnitNotes"]);
  ac.addRow(["Mag lock", "EACH", "0.5", ""]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("attribute-io parse + plan", () => {
  it("plans creates from empty snapshot", async () => {
    const parsed = await parseAttributeWorkbookBuffer(
      await syntheticAttributeListsBuffer(),
    );
    assert.equal(parsed.layoutOk, true);
    assert.equal(parsed.attributes.length, 2);
    assert.equal(
      parsed.attributes.reduce((n, a) => n + a.options.length, 0),
      3,
    );

    const plan = planAttributeImport(
      { attributes: [] },
      parsed,
    );
    const summary = summarizeAttributePlan(plan);
    assert.equal(summary.attributesCreated, 2);
    assert.equal(summary.optionsCreated, 3);
    assert.equal(summary.optionsUpdated, 0);
  });

  it("re-plan is idempotent when snapshot matches file", async () => {
    const parsed = await parseAttributeWorkbookBuffer(
      await syntheticAttributeListsBuffer(),
    );
    const snapshot = snapshotFromParsed(parsed);
    const plan = planAttributeImport(snapshot, parsed);
    const summary = summarizeAttributePlan(plan);
    assert.equal(summary.attributesCreated, 0);
    assert.equal(summary.optionsCreated, 0);
    assert.equal(summary.optionsUpdated, 0);
    assert.equal(summary.optionsUnchanged, 3);
  });

  it("detects option label/sortOrder update", async () => {
    const parsed = await parseAttributeWorkbookBuffer(
      await syntheticAttributeListsBuffer(),
    );
    const snapshot = snapshotFromParsed(parsed);
    const opt = snapshot.attributes
      .flatMap((a) => a.options)
      .find((o) => o.value === "black")!;
    opt.label = "Old Black";
    opt.sortOrder = 99;

    const plan = planAttributeImport(snapshot, parsed);
    assert.equal(plan.optionUpdates.length, 1);
    assert.equal(plan.optionUpdates[0]!.value, "black");
    assert.ok(plan.optionUpdates[0]!.changes.some((c) => c.field === "label"));
    assert.ok(
      plan.optionUpdates[0]!.changes.some((c) => c.field === "sortOrder"),
    );
  });

  it("export then re-import yields zero changes", async () => {
    const parsed = await parseAttributeWorkbookBuffer(
      await syntheticAttributeListsBuffer(),
    );
    const exported = await buildAttributeExportWorkbookBuffer(
      parsed.attributes.map((a) => ({
        slug: a.slug,
        name: a.name,
        options: a.options.map((o) => ({
          label: o.label,
          sortOrder: o.sortOrder,
        })),
      })),
    );
    const reparsed = await parseAttributeWorkbookBuffer(exported);
    const plan = planAttributeImport(snapshotFromParsed(parsed), reparsed);
    const summary = summarizeAttributePlan(plan);
    assert.equal(summary.attributesCreated, 0);
    assert.equal(summary.optionsCreated, 0);
    assert.equal(summary.optionsUpdated, 0);
  });

  it("rejects catalog-shaped workbook", async () => {
    const parsed = await parseAttributeWorkbookBuffer(
      await catalogShapedBuffer(),
    );
    assert.equal(parsed.layoutOk, false);
    assert.equal(parsed.attributes.length, 0);
    const plan = planAttributeImport({ attributes: [] }, parsed);
    assert.equal(plan.layoutOk, false);
    assert.equal(plan.attributeCreates.length, 0);
  });
});

const FIXTURE = path.join(
  process.cwd(),
  "claude/prompts/samples/attribute-lists-2026-06-24.xlsx",
);

describe("attribute-lists fixture", () => {
  it("parses ground-truth counts when fixture is present", async () => {
    if (!existsSync(FIXTURE)) {
      console.log("skip: fixture not present at", FIXTURE);
      return;
    }
    const buf = await readFile(FIXTURE);
    const parsed = await parseAttributeWorkbookBuffer(buf);
    assert.equal(parsed.layoutOk, true);
    assert.equal(parsed.attributes.length, 6);

    const bySlug = Object.fromEntries(
      parsed.attributes.map((a) => [a.slug, a.options.length]),
    );
    assert.equal(bySlug["attachment_type_pathways"], 14);
    assert.equal(bySlug["box_length"], 6);
    assert.equal(bySlug["color"], 31);
    assert.equal(bySlug["length_feet"], 14);
    assert.equal(bySlug["manufacturer"], 59);
    assert.equal(bySlug["vendor"], 10);

    const total = parsed.attributes.reduce((n, a) => n + a.options.length, 0);
    assert.equal(total, 134);

    const plan = planAttributeImport({ attributes: [] }, parsed);
    assert.equal(plan.attributeCreates.length, 6);
    assert.equal(plan.optionCreates.length, 134);
  });
});

function snapshotFromParsed(
  parsed: ParsedAttributeWorkbook,
): ExistingAttributeSnapshot {
  return {
    attributes: parsed.attributes.map((a, i) => ({
      id: `a${i}`,
      slug: a.slug,
      name: a.name,
      options: a.options.map((o, j) => ({
        id: `o${i}_${j}`,
        attributeId: `a${i}`,
        value: o.value,
        label: o.label,
        sortOrder: o.sortOrder,
      })),
    })),
  };
}
