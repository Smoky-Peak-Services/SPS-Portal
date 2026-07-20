/**
 * Write canonical attribute lists to an Excel fixture for import/export tests.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import ExcelJS from "exceljs";
import { CANONICAL_ATTRIBUTE_LISTS } from "../src/features/materials/attribute-list-defs";

export const CANONICAL_ATTRIBUTE_FIXTURE_REL =
  "claude/prompts/samples/attribute-lists-canonical.xlsx";

export async function writeCanonicalAttributeFixture(
  outPath?: string,
): Promise<string> {
  const target =
    outPath ?? join(process.cwd(), CANONICAL_ATTRIBUTE_FIXTURE_REL);
  mkdirSync(dirname(target), { recursive: true });

  const selectLists = CANONICAL_ATTRIBUTE_LISTS.filter(
    (d) => (d.inputType ?? "SELECT") === "SELECT",
  );

  const wb = new ExcelJS.Workbook();
  const index = wb.addWorksheet("Attribute Lists");
  index.addRow(["list_key", "list_name", "filter_mode"]);
  for (const def of selectLists) {
    index.addRow([def.slug, def.name, ""]);
  }

  for (const def of selectLists) {
    const sheet = wb.addWorksheet(def.slug.slice(0, 31));
    sheet.addRow(["label", "sort_order", "tags", "rfq_contact", "rfq_email"]);
    for (const opt of def.options) {
      sheet.addRow([opt.label, opt.sortOrder, "", "", ""]);
    }
  }

  await wb.xlsx.writeFile(target);
  return target;
}

async function main() {
  const path = await writeCanonicalAttributeFixture();
  const selectLists = CANONICAL_ATTRIBUTE_LISTS.filter(
    (d) => (d.inputType ?? "SELECT") === "SELECT",
  );
  const totalOpts = selectLists.reduce((n, a) => n + a.options.length, 0);
  console.log(
    `Wrote ${path} (${selectLists.length} attributes, ${totalOpts} options)`,
  );
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("write-attribute-lists-fixture.ts");

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
