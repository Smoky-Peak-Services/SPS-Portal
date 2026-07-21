/**
 * Attribute picklist Excel import/export — pure logic, no Prisma.
 *
 * Workbook shape:
 *   Index sheet "Attribute Lists": list_key | list_name | filter_mode
 *   One sheet per list_key: label | sort_order | tags | rfq_contact | rfq_email
 *
 * filter_mode / tags / rfq_* are ignored on import and left blank on export.
 * Import never deletes rows missing from the file.
 */

import ExcelJS from "exceljs";
import { cellValue, safeSheetName, worksheetToAoa } from "./io";
import { normalizeName, slugify } from "./normalize";

export const INDEX_SHEET_NAME = "Attribute Lists";
export const INDEX_HEADERS = ["list_key", "list_name", "filter_mode"] as const;
export const OPTION_HEADERS = [
  "label",
  "sort_order",
  "tags",
  "rfq_contact",
  "rfq_email",
] as const;

export type AttrRowWarning = {
  sheet: string;
  row: number;
  message: string;
};

export type ParsedAttrOption = {
  label: string;
  value: string;
  sortOrder: number;
  sheet: string;
  row: number;
};

export type ParsedAttrList = {
  slug: string;
  name: string;
  options: ParsedAttrOption[];
  /** True when the option sheet matched the expected header layout. */
  sheetMatched: boolean;
};

export type ParsedAttributeWorkbook = {
  attributes: ParsedAttrList[];
  warnings: AttrRowWarning[];
  sheetsTotal: number;
  sheetsMatched: number;
  hasIndex: boolean;
  layoutOk: boolean;
  layoutMessage: string | null;
};

export function unmatchedAttributeListsMessage(detail: string): string {
  return `This file doesn't look like an attribute-lists export — ${detail}`;
}

export type ExistingAttrOption = {
  id: string;
  attributeId: string;
  value: string;
  label: string;
  sortOrder: number;
};

export type ExistingAttribute = {
  id: string;
  slug: string;
  name: string;
  options: ExistingAttrOption[];
};

export type ExistingAttributeSnapshot = {
  attributes: ExistingAttribute[];
};

export type AttrFieldChange = {
  field: "label" | "sortOrder" | "name";
  from: string;
  to: string;
};

export type PlannedAttrCreate = { slug: string; name: string };
export type PlannedAttrUpdate = {
  id: string;
  slug: string;
  name: string;
  changes: AttrFieldChange[];
};
export type PlannedOptionCreate = {
  attributeSlug: string;
  label: string;
  value: string;
  sortOrder: number;
  sheet: string;
  row: number;
};
export type PlannedOptionUpdate = {
  id: string;
  attributeSlug: string;
  label: string;
  value: string;
  sortOrder: number;
  changes: AttrFieldChange[];
  sheet: string;
  row: number;
};

export type AttributeImportPlan = {
  attributeCreates: PlannedAttrCreate[];
  attributeUpdates: PlannedAttrUpdate[];
  optionCreates: PlannedOptionCreate[];
  optionUpdates: PlannedOptionUpdate[];
  unchangedOptionCount: number;
  unchangedAttributeCount: number;
  warnings: AttrRowWarning[];
  sheetsTotal: number;
  sheetsMatched: number;
  layoutOk: boolean;
  layoutMessage: string | null;
};

export type ExportAttrOption = {
  label: string;
  sortOrder: number;
};

export type ExportAttribute = {
  slug: string;
  name: string;
  options: ExportAttrOption[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function normCells(row: unknown[]): string[] {
  return (row ?? []).map((c) => cellStr(c));
}

function isBlankRow(cells: string[]): boolean {
  return !cells.some((c) => c !== "");
}

function headerMap(cells: string[]): Map<string, number> {
  const m = new Map<string, number>();
  cells.forEach((c, i) => {
    const key = c.toLowerCase().replace(/\s+/g, "_");
    if (key) m.set(key, i);
  });
  return m;
}

function parseSortOrder(
  raw: string,
  sheet: string,
  row: number,
  warnings: AttrRowWarning[],
): number {
  const t = raw.trim();
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) {
    warnings.push({
      sheet,
      row,
      message: `Unparseable sort_order "${raw}"; defaulting to 0`,
    });
    return 0;
  }
  return Math.trunc(n);
}

export function attributeListsExportFileName(
  scopeCode: string,
  date = new Date(),
): string {
  return `attribute-lists_${scopeCode}_${date.toISOString().slice(0, 10)}.xlsx`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function parseIndexSheet(aoa: unknown[][]): {
  entries: { slug: string; name: string; row: number }[];
  warnings: AttrRowWarning[];
  matched: boolean;
} {
  const warnings: AttrRowWarning[] = [];
  const entries: { slug: string; name: string; row: number }[] = [];
  let headerIdx = -1;
  let cols: Map<string, number> | null = null;

  for (let i = 0; i < aoa.length; i++) {
    const cells = normCells(aoa[i] ?? []);
    if (isBlankRow(cells)) continue;
    const map = headerMap(cells);
    if (map.has("list_key")) {
      headerIdx = i;
      cols = map;
      break;
    }
  }

  if (headerIdx < 0 || !cols) {
    return { entries: [], warnings, matched: false };
  }

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const excelRow = i + 1;
    const cells = normCells(aoa[i] ?? []);
    if (isBlankRow(cells)) continue;
    const slugRaw = cells[cols.get("list_key") ?? 0] ?? "";
    const nameRaw = cells[cols.get("list_name") ?? 1] ?? "";
    const slug = slugRaw.trim().toLowerCase();
    const name = normalizeName(nameRaw) || slug;
    if (!slug) {
      warnings.push({
        sheet: INDEX_SHEET_NAME,
        row: excelRow,
        message: "Index row missing list_key; skipped",
      });
      continue;
    }
    entries.push({ slug, name, row: excelRow });
  }

  return { entries, warnings, matched: true };
}

function parseOptionSheet(
  sheetName: string,
  aoa: unknown[][],
): {
  options: ParsedAttrOption[];
  warnings: AttrRowWarning[];
  matched: boolean;
} {
  const warnings: AttrRowWarning[] = [];
  let headerIdx = -1;
  let cols: Map<string, number> | null = null;

  for (let i = 0; i < aoa.length; i++) {
    const cells = normCells(aoa[i] ?? []);
    if (isBlankRow(cells)) continue;
    const map = headerMap(cells);
    if (map.has("label")) {
      headerIdx = i;
      cols = map;
      break;
    }
  }

  if (headerIdx < 0 || !cols) {
    return { options: [], warnings, matched: false };
  }

  const options: ParsedAttrOption[] = [];
  const seenValues = new Set<string>();

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const excelRow = i + 1;
    const cells = normCells(aoa[i] ?? []);
    if (isBlankRow(cells)) continue;
    const label = normalizeName(cells[cols.get("label") ?? 0] ?? "");
    if (!label) {
      warnings.push({
        sheet: sheetName,
        row: excelRow,
        message: "Option row missing label; skipped",
      });
      continue;
    }
    const value = slugify(label);
    if (!value) {
      warnings.push({
        sheet: sheetName,
        row: excelRow,
        message: `Could not derive value from label "${label}"; skipped`,
      });
      continue;
    }
    if (seenValues.has(value)) {
      warnings.push({
        sheet: sheetName,
        row: excelRow,
        message: `Duplicate option value "${value}" in sheet; later row skipped`,
      });
      continue;
    }
    seenValues.add(value);
    const sortRaw = cells[cols.get("sort_order") ?? 1] ?? "";
    options.push({
      label,
      value,
      sortOrder: parseSortOrder(sortRaw, sheetName, excelRow, warnings),
      sheet: sheetName,
      row: excelRow,
    });
  }

  return { options, warnings, matched: true };
}

export function parseAttributeWorkbookAoa(
  sheets: { name: string; aoa: unknown[][] }[],
): ParsedAttributeWorkbook {
  const warnings: AttrRowWarning[] = [];
  const sheetsTotal = sheets.filter((s) => normalizeName(s.name)).length;

  const indexSheet = sheets.find(
    (s) =>
      normalizeName(s.name).toLowerCase() === INDEX_SHEET_NAME.toLowerCase(),
  );

  if (!indexSheet) {
    return {
      attributes: [],
      warnings: [
        {
          sheet: "",
          row: 0,
          message: `Missing index sheet "${INDEX_SHEET_NAME}"`,
        },
      ],
      sheetsTotal,
      sheetsMatched: 0,
      hasIndex: false,
      layoutOk: false,
      layoutMessage: unmatchedAttributeListsMessage(
        `missing "${INDEX_SHEET_NAME}" index sheet`,
      ),
    };
  }

  const index = parseIndexSheet(indexSheet.aoa);
  warnings.push(...index.warnings);

  if (!index.matched) {
    return {
      attributes: [],
      warnings: [
        ...warnings,
        {
          sheet: INDEX_SHEET_NAME,
          row: 0,
          message: `Sheet '${INDEX_SHEET_NAME}' doesn't match attribute-lists layout (no list_key header) — entire workbook rejected`,
        },
      ],
      sheetsTotal,
      sheetsMatched: 0,
      hasIndex: true,
      layoutOk: false,
      layoutMessage: unmatchedAttributeListsMessage(
        `index sheet has no list_key header`,
      ),
    };
  }

  const bySlug = new Map<string, ParsedAttrList>();
  for (const e of index.entries) {
    if (bySlug.has(e.slug)) {
      warnings.push({
        sheet: INDEX_SHEET_NAME,
        row: e.row,
        message: `Duplicate list_key "${e.slug}" in index; later row ignored`,
      });
      continue;
    }
    bySlug.set(e.slug, {
      slug: e.slug,
      name: e.name,
      options: [],
      sheetMatched: false,
    });
  }

  const knownSlugs = new Set(bySlug.keys());
  let sheetsMatched = 0; // option sheets that matched layout

  for (const { name, aoa } of sheets) {
    const sheetName = normalizeName(name);
    if (!sheetName) continue;
    if (sheetName.toLowerCase() === INDEX_SHEET_NAME.toLowerCase()) continue;

    const slug = sheetName.trim().toLowerCase();
    if (!knownSlugs.has(slug)) {
      warnings.push({
        sheet: sheetName,
        row: 0,
        message: `Sheet '${sheetName}' is not listed in the index — entire sheet skipped`,
      });
      continue;
    }

    const parsed = parseOptionSheet(sheetName, aoa);
    if (!parsed.matched) {
      warnings.push({
        sheet: sheetName,
        row: 0,
        message: `Sheet '${sheetName}' doesn't match option-list layout (no label header) — entire sheet skipped`,
      });
      continue;
    }

    sheetsMatched += 1;
    warnings.push(...parsed.warnings);
    const attr = bySlug.get(slug)!;
    attr.sheetMatched = true;
    attr.options = parsed.options;
  }

  // Attributes with no option sheet: still valid (empty picklist) if indexed
  const attributes = [...bySlug.values()];
  for (const a of attributes) {
    if (!a.sheetMatched) {
      warnings.push({
        sheet: a.slug,
        row: 0,
        message: `No matching option sheet for list_key "${a.slug}" — attribute will import with zero options`,
      });
    }
  }

  // layoutOk: valid index with at least one attribute listed.
  // Empty option sheets / missing option sheets are warnings, not layout failure.
  const layoutOkFinal = index.matched && attributes.length > 0;

  return {
    attributes,
    warnings,
    sheetsTotal,
    sheetsMatched: sheetsMatched + (index.matched ? 1 : 0),
    hasIndex: true,
    layoutOk: layoutOkFinal,
    layoutMessage: layoutOkFinal
      ? null
      : unmatchedAttributeListsMessage(
          attributes.length === 0
            ? "index has no list_key rows and no option sheets matched"
            : "0 sheets matched the expected layout",
        ),
  };
}

export async function parseAttributeWorkbookBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedAttributeWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const sheets = wb.worksheets.map((ws) => ({
    name: ws.name,
    aoa: worksheetToAoa(ws),
  }));
  return parseAttributeWorkbookAoa(sheets);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function planAttributeImport(
  existing: ExistingAttributeSnapshot,
  parsed: ParsedAttributeWorkbook,
): AttributeImportPlan {
  const warnings = [...parsed.warnings];

  if (!parsed.layoutOk) {
    return {
      attributeCreates: [],
      attributeUpdates: [],
      optionCreates: [],
      optionUpdates: [],
      unchangedOptionCount: 0,
      unchangedAttributeCount: 0,
      warnings,
      sheetsTotal: parsed.sheetsTotal,
      sheetsMatched: parsed.sheetsMatched,
      layoutOk: false,
      layoutMessage:
        parsed.layoutMessage ??
        unmatchedAttributeListsMessage("layout mismatch"),
    };
  }

  const attributeCreates: PlannedAttrCreate[] = [];
  const attributeUpdates: PlannedAttrUpdate[] = [];
  const optionCreates: PlannedOptionCreate[] = [];
  const optionUpdates: PlannedOptionUpdate[] = [];
  let unchangedOptionCount = 0;
  let unchangedAttributeCount = 0;

  const existingBySlug = new Map(
    existing.attributes.map((a) => [a.slug.toLowerCase(), a]),
  );

  for (const attr of parsed.attributes) {
    const ex = existingBySlug.get(attr.slug.toLowerCase());
    if (!ex) {
      attributeCreates.push({ slug: attr.slug, name: attr.name });
      for (const opt of attr.options) {
        optionCreates.push({
          attributeSlug: attr.slug,
          label: opt.label,
          value: opt.value,
          sortOrder: opt.sortOrder,
          sheet: opt.sheet,
          row: opt.row,
        });
      }
      continue;
    }

    const nameChanges: AttrFieldChange[] = [];
    if (normalizeName(ex.name) !== normalizeName(attr.name)) {
      nameChanges.push({
        field: "name",
        from: ex.name,
        to: attr.name,
      });
    }
    if (nameChanges.length > 0) {
      attributeUpdates.push({
        id: ex.id,
        slug: attr.slug,
        name: attr.name,
        changes: nameChanges,
      });
    } else {
      unchangedAttributeCount += 1;
    }

    const optByValue = new Map(
      ex.options.map((o) => [o.value.toLowerCase(), o]),
    );
    for (const opt of attr.options) {
      const existingOpt = optByValue.get(opt.value.toLowerCase());
      if (!existingOpt) {
        optionCreates.push({
          attributeSlug: attr.slug,
          label: opt.label,
          value: opt.value,
          sortOrder: opt.sortOrder,
          sheet: opt.sheet,
          row: opt.row,
        });
        continue;
      }
      const changes: AttrFieldChange[] = [];
      if (normalizeName(existingOpt.label) !== normalizeName(opt.label)) {
        changes.push({
          field: "label",
          from: existingOpt.label,
          to: opt.label,
        });
      }
      if (existingOpt.sortOrder !== opt.sortOrder) {
        changes.push({
          field: "sortOrder",
          from: String(existingOpt.sortOrder),
          to: String(opt.sortOrder),
        });
      }
      if (changes.length > 0) {
        optionUpdates.push({
          id: existingOpt.id,
          attributeSlug: attr.slug,
          label: opt.label,
          value: opt.value,
          sortOrder: opt.sortOrder,
          changes,
          sheet: opt.sheet,
          row: opt.row,
        });
      } else {
        unchangedOptionCount += 1;
      }
    }
  }

  return {
    attributeCreates,
    attributeUpdates,
    optionCreates,
    optionUpdates,
    unchangedOptionCount,
    unchangedAttributeCount,
    warnings,
    sheetsTotal: parsed.sheetsTotal,
    sheetsMatched: parsed.sheetsMatched,
    layoutOk: true,
    layoutMessage: null,
  };
}

export function summarizeAttributePlan(plan: AttributeImportPlan) {
  return {
    attributesCreated: plan.attributeCreates.length,
    attributesUpdated: plan.attributeUpdates.length,
    attributesUnchanged: plan.unchangedAttributeCount,
    optionsCreated: plan.optionCreates.length,
    optionsUpdated: plan.optionUpdates.length,
    optionsUnchanged: plan.unchangedOptionCount,
    warningCount: plan.warnings.length,
    sheetsTotal: plan.sheetsTotal,
    sheetsMatched: plan.sheetsMatched,
    layoutOk: plan.layoutOk,
    layoutMessage: plan.layoutMessage,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function buildAttributeExportAoa(attributes: ExportAttribute[]): {
  sheetName: string;
  aoa: (string | number)[][];
}[] {
  const sorted = [...attributes].sort((a, b) => a.slug.localeCompare(b.slug));
  const used = new Set<string>();
  const sheets: { sheetName: string; aoa: (string | number)[][] }[] = [];

  const indexAoa: (string | number)[][] = [[...INDEX_HEADERS]];
  for (const a of sorted) {
    indexAoa.push([a.slug, a.name, ""]);
  }
  sheets.push({
    sheetName: safeSheetName(INDEX_SHEET_NAME, used),
    aoa: indexAoa,
  });

  for (const a of sorted) {
    const aoa: (string | number)[][] = [[...OPTION_HEADERS]];
    const opts = [...a.options].sort(
      (x, y) => x.sortOrder - y.sortOrder || x.label.localeCompare(y.label),
    );
    for (const o of opts) {
      aoa.push([o.label, o.sortOrder, "", "", ""]);
    }
    sheets.push({
      sheetName: safeSheetName(a.slug, used),
      aoa,
    });
  }

  return sheets;
}

export async function buildAttributeExportWorkbookBuffer(
  attributes: ExportAttribute[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheets = buildAttributeExportAoa(attributes);
  for (const { sheetName, aoa } of sheets) {
    const ws = wb.addWorksheet(sheetName);
    for (const row of aoa) {
      ws.addRow(row);
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Re-export for tests that build AOA from exceljs rows
export { cellValue };
