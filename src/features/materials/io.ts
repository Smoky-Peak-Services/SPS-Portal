/**
 * Materials catalog Excel import/export — pure logic, no Prisma.
 *
 * Sheet layout (one sheet per domain name):
 *   category title row → header description|unit|laborUnits|laborUnitNotes
 *   → zero+ item rows → blank separator between categories.
 *
 * Import never deletes rows missing from the file.
 */

import ExcelJS from "exceljs";
import { nameMatchKey, normalizeName, slugify } from "./normalize";
import { exportFileName as scopeExportFileName } from "./scope-code";

export const ITEM_HEADERS = [
  "description",
  "unit",
  "laborUnits",
  "laborUnitNotes",
] as const;

export type RowWarning = {
  sheet: string;
  row: number;
  message: string;
};

export type ParsedItem = {
  name: string;
  unitCode: string;
  laborUnits: number;
  laborUnitNotes: string | null;
  sheet: string;
  row: number;
  warnings: RowWarning[];
};

export type ParsedCategory = {
  name: string;
  sheet: string;
  row: number;
  items: ParsedItem[];
};

export type ParsedDomain = {
  name: string;
  sheet: string;
  categories: ParsedCategory[];
};

export type ParsedWorkbook = {
  domains: ParsedDomain[];
  warnings: RowWarning[];
  /** Named worksheets considered for catalog layout (non-blank names). */
  sheetsTotal: number;
  /** Sheets that produced at least one category block. */
  sheetsMatched: number;
  /** True when at least one sheet matched catalog layout. */
  layoutOk: boolean;
  /** Set when layoutOk is false. */
  layoutMessage: string | null;
};

export function unmatchedCatalogMessage(sheetsTotal: number): string {
  return `This file doesn't look like a materials catalog export — 0 of ${sheetsTotal} sheets matched the expected layout.`;
}

export type ExistingUnit = { id: string; code: string };

export type ExistingDomain = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type ExistingCategory = {
  id: string;
  domainId: string;
  domainSlug: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type ExistingItem = {
  id: string;
  categoryId: string;
  domainSlug: string;
  categorySlug: string;
  name: string;
  unitCode: string;
  laborUnits: string;
  laborUnitNotes: string | null;
};

export type ExistingSnapshot = {
  units: ExistingUnit[];
  domains: ExistingDomain[];
  categories: ExistingCategory[];
  items: ExistingItem[];
};

export type FieldChange = {
  field: "unit" | "laborUnits" | "laborUnitNotes";
  from: string;
  to: string;
};

export type PlannedDomainCreate = { name: string; slug: string };
export type PlannedCategoryCreate = {
  domainSlug: string;
  name: string;
  slug: string;
};
export type PlannedUnitCreate = { code: string };
export type PlannedItemCreate = {
  domainSlug: string;
  categorySlug: string;
  name: string;
  unitCode: string;
  laborUnits: number;
  laborUnitNotes: string | null;
  sheet: string;
  row: number;
};
export type PlannedItemUpdate = {
  id: string;
  name: string;
  domainSlug: string;
  categorySlug: string;
  unitCode: string;
  laborUnits: number;
  laborUnitNotes: string | null;
  changes: FieldChange[];
  sheet: string;
  row: number;
};

export type ImportPlan = {
  domainCreates: PlannedDomainCreate[];
  categoryCreates: PlannedCategoryCreate[];
  unitCreates: PlannedUnitCreate[];
  itemCreates: PlannedItemCreate[];
  itemUpdates: PlannedItemUpdate[];
  unchangedItemCount: number;
  warnings: RowWarning[];
  sheetsTotal: number;
  sheetsMatched: number;
  layoutOk: boolean;
  layoutMessage: string | null;
};

export type ExportItem = {
  name: string;
  unitCode: string;
  laborUnits: string;
  laborUnitNotes: string | null;
};

export type ExportCategory = {
  name: string;
  sortOrder: number;
  items: ExportItem[];
};

export type ExportDomain = {
  name: string;
  sortOrder: number;
  categories: ExportCategory[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellStr(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normCells(row: unknown[]): string[] {
  return (row ?? []).map((c) => cellStr(c).trim());
}

function isBlankRow(cells: string[]): boolean {
  return !cells.some((c) => c !== "");
}

function isHeaderRow(cells: string[]): boolean {
  return cells[0]?.toLowerCase() === "description";
}

function notesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a?.trim() || "") === (b?.trim() || "");
}

function notesStored(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Stable string for laborUnits compare / display. */
export function formatLaborUnits(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 10000) / 10000;
  return String(rounded);
}

export function parseLaborUnits(
  raw: string,
  sheet: string,
  row: number,
): { value: number; warning?: RowWarning } {
  const t = raw.trim();
  if (!t) {
    return {
      value: 0,
      warning: {
        sheet,
        row,
        message: "Missing laborUnits; defaulting to 0",
      },
    };
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return {
      value: 0,
      warning: {
        sheet,
        row,
        message: `Unparseable laborUnits "${raw}"; defaulting to 0`,
      },
    };
  }
  return { value: n };
}

export function safeSheetName(base: string, used: Set<string>): string {
  const name =
    base
      .replace(/[\[\]:*?/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Sheet";
  let n = name;
  let i = 2;
  while (used.has(n.toLowerCase())) {
    const suf = ` (${i++})`;
    n = name.slice(0, 31 - suf.length) + suf;
  }
  used.add(n.toLowerCase());
  return n;
}

export { scopeExportFileName as exportFileName };

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse one domain sheet (AOA) into categories (including empty ones) + items.
 * Excel row numbers are 1-based to match spreadsheet UI.
 */
export function parseDomainSheet(
  domainName: string,
  aoa: unknown[][],
): { categories: ParsedCategory[]; warnings: RowWarning[] } {
  const sheet = normalizeName(domainName) || domainName.trim() || "Sheet";
  const categories: ParsedCategory[] = [];
  const warnings: RowWarning[] = [];
  let current: ParsedCategory | null = null;
  let expectHeader = false;

  for (let i = 0; i < aoa.length; i++) {
    const excelRow = i + 1;
    const cells = normCells(aoa[i] ?? []);
    if (isBlankRow(cells)) {
      current = null;
      expectHeader = false;
      continue;
    }

    if (isHeaderRow(cells)) {
      if (!current) {
        warnings.push({
          sheet,
          row: excelRow,
          message: "Header row without a preceding category title; skipped",
        });
        continue;
      }
      expectHeader = false;
      continue;
    }

    // Look ahead: if next non-empty is a header, this row is a category title.
    let nextIdx = -1;
    for (let j = i + 1; j < aoa.length; j++) {
      if (!isBlankRow(normCells(aoa[j] ?? []))) {
        nextIdx = j;
        break;
      }
    }
    const nextIsHeader =
      nextIdx >= 0 && isHeaderRow(normCells(aoa[nextIdx] ?? []));

    if (nextIsHeader || expectHeader) {
      const catName = normalizeName(cells[0] ?? "");
      if (!catName) {
        warnings.push({
          sheet,
          row: excelRow,
          message: "Empty category title; skipped",
        });
        current = null;
        expectHeader = false;
        continue;
      }
      current = {
        name: catName,
        sheet,
        row: excelRow,
        items: [],
      };
      categories.push(current);
      expectHeader = false;
      continue;
    }

    if (!current) {
      warnings.push({
        sheet,
        row: excelRow,
        message: "Data row outside a category block; skipped",
      });
      continue;
    }

    const rawDesc = cells[0] ?? "";
    const name = normalizeName(rawDesc);
    if (!name) {
      warnings.push({
        sheet,
        row: excelRow,
        message: "Item row missing description; skipped",
      });
      continue;
    }

    const itemWarnings: RowWarning[] = [];
    let unitCode = (cells[1] ?? "").trim().toUpperCase();
    if (!unitCode) {
      const w: RowWarning = {
        sheet,
        row: excelRow,
        message: "Blank unit; defaulting to EACH",
      };
      itemWarnings.push(w);
      warnings.push(w);
      unitCode = "EACH";
    }

    const labor = parseLaborUnits(cells[2] ?? "", sheet, excelRow);
    if (labor.warning) {
      itemWarnings.push(labor.warning);
      warnings.push(labor.warning);
    }

    current.items.push({
      name,
      unitCode,
      laborUnits: labor.value,
      laborUnitNotes: notesStored(cells[3]),
      sheet,
      row: excelRow,
      warnings: itemWarnings,
    });
  }

  return { categories, warnings };
}

export function parseWorkbookAoa(
  sheets: { name: string; aoa: unknown[][] }[],
): ParsedWorkbook {
  const domains: ParsedDomain[] = [];
  const warnings: RowWarning[] = [];
  const seenDomainKeys = new Map<string, string>();
  let sheetsTotal = 0;
  let sheetsMatched = 0;

  for (const { name, aoa } of sheets) {
    const domainName = normalizeName(name);
    if (!domainName) continue;
    sheetsTotal += 1;
    const key = nameMatchKey(domainName);
    if (seenDomainKeys.has(key)) {
      warnings.push({
        sheet: domainName,
        row: 0,
        message: `Duplicate domain sheet for "${domainName}" (also "${seenDomainKeys.get(key)}"); later sheet ignored`,
      });
      continue;
    }
    seenDomainKeys.set(key, domainName);

    const { categories, warnings: sheetWarnings } = parseDomainSheet(
      domainName,
      aoa,
    );

    // Dedupe categories within sheet by match key (keep first).
    const catSeen = new Map<string, ParsedCategory>();
    const deduped: ParsedCategory[] = [];
    for (const cat of categories) {
      const ck = nameMatchKey(cat.name);
      const prior = catSeen.get(ck);
      if (prior) {
        warnings.push({
          sheet: domainName,
          row: cat.row,
          message: `Duplicate category "${cat.name}" in sheet; merging items into first occurrence`,
        });
        prior.items.push(...cat.items);
        continue;
      }
      catSeen.set(ck, cat);
      deduped.push(cat);
    }

    // No category title→header match → not a catalog sheet (do not create a domain).
    if (deduped.length === 0) {
      warnings.push({
        sheet: domainName,
        row: 0,
        message: `Sheet '${domainName}' doesn't match the catalog layout (no category header row found) — entire sheet skipped`,
      });
      continue;
    }

    sheetsMatched += 1;
    warnings.push(...sheetWarnings);
    domains.push({
      name: domainName,
      sheet: domainName,
      categories: deduped,
    });
  }

  const layoutOk = sheetsMatched > 0;
  return {
    domains,
    warnings,
    sheetsTotal,
    sheetsMatched,
    layoutOk,
    layoutMessage: layoutOk ? null : unmatchedCatalogMessage(sheetsTotal),
  };
}

/** ExcelJS cell → string/number for AOA. */
export function cellValue(value: ExcelJS.CellValue): string | number {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    if ("result" in value && value.result != null) {
      return cellValue(value.result as ExcelJS.CellValue);
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value;
  return String(value);
}

export function worksheetToAoa(ws: ExcelJS.Worksheet): unknown[][] {
  const aoa: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values;
    if (!Array.isArray(values)) {
      aoa.push([]);
      return;
    }
    aoa.push(values.slice(1).map((v) => cellValue(v as ExcelJS.CellValue)));
  });
  return aoa;
}

export async function parseWorkbookBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const sheets = wb.worksheets.map((ws) => ({
    name: ws.name,
    aoa: worksheetToAoa(ws),
  }));
  return parseWorkbookAoa(sheets);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function planImport(
  existing: ExistingSnapshot,
  parsed: ParsedWorkbook,
): ImportPlan {
  const domainCreates: PlannedDomainCreate[] = [];
  const categoryCreates: PlannedCategoryCreate[] = [];
  const unitCreates: PlannedUnitCreate[] = [];
  const itemCreates: PlannedItemCreate[] = [];
  const itemUpdates: PlannedItemUpdate[] = [];
  let unchangedItemCount = 0;
  const warnings = [...parsed.warnings];

  if (!parsed.layoutOk) {
    return {
      domainCreates: [],
      categoryCreates: [],
      unitCreates: [],
      itemCreates: [],
      itemUpdates: [],
      unchangedItemCount: 0,
      warnings,
      sheetsTotal: parsed.sheetsTotal,
      sheetsMatched: parsed.sheetsMatched,
      layoutOk: false,
      layoutMessage:
        parsed.layoutMessage ?? unmatchedCatalogMessage(parsed.sheetsTotal),
    };
  }

  const domainByKey = new Map(
    existing.domains.map((d) => [nameMatchKey(d.name), d]),
  );
  // Also index by slug for robustness
  for (const d of existing.domains) {
    domainByKey.set(d.slug.toLowerCase(), d);
  }

  const categoriesByDomainSlug = new Map<string, Map<string, ExistingCategory>>();
  for (const c of existing.categories) {
    let m = categoriesByDomainSlug.get(c.domainSlug);
    if (!m) {
      m = new Map();
      categoriesByDomainSlug.set(c.domainSlug, m);
    }
    m.set(nameMatchKey(c.name), c);
    m.set(c.slug.toLowerCase(), c);
  }

  const itemsByCategoryId = new Map<string, Map<string, ExistingItem>>();
  for (const item of existing.items) {
    let m = itemsByCategoryId.get(item.categoryId);
    if (!m) {
      m = new Map();
      itemsByCategoryId.set(item.categoryId, m);
    }
    m.set(nameMatchKey(item.name), item);
  }

  const unitCodes = new Set(
    existing.units.map((u) => u.code.trim().toUpperCase()),
  );
  const plannedUnits = new Set<string>();
  const plannedDomains = new Map<string, PlannedDomainCreate>();
  const plannedCategories = new Map<string, PlannedCategoryCreate>();

  function ensureUnit(code: string) {
    const upper = code.trim().toUpperCase();
    if (!upper) return;
    if (unitCodes.has(upper) || plannedUnits.has(upper)) return;
    plannedUnits.add(upper);
    unitCreates.push({ code: upper });
  }

  for (const domain of parsed.domains) {
    const domainSlug = slugify(domain.name);
    const domainKey = nameMatchKey(domain.name);
    let existingDomain = domainByKey.get(domainKey);
    if (!existingDomain) {
      existingDomain = domainByKey.get(domainSlug.toLowerCase());
    }
    if (!existingDomain && !plannedDomains.has(domainSlug)) {
      const create = { name: domain.name, slug: domainSlug };
      plannedDomains.set(domainSlug, create);
      domainCreates.push(create);
    }
    const resolvedDomainSlug = existingDomain?.slug ?? domainSlug;

    for (const cat of domain.categories) {
      const catSlug = slugify(cat.name);
      const catKey = `${resolvedDomainSlug}|${catSlug}`;
      const catMap = categoriesByDomainSlug.get(resolvedDomainSlug);
      const existingCat =
        catMap?.get(nameMatchKey(cat.name)) ??
        catMap?.get(catSlug.toLowerCase());

      if (!existingCat && !plannedCategories.has(catKey)) {
        const create = {
          domainSlug: resolvedDomainSlug,
          name: cat.name,
          slug: catSlug,
        };
        plannedCategories.set(catKey, create);
        categoryCreates.push(create);
      }

      for (const item of cat.items) {
        ensureUnit(item.unitCode);

        if (existingCat) {
          const byName = itemsByCategoryId.get(existingCat.id);
          const existingItem = byName?.get(nameMatchKey(item.name));
          if (existingItem) {
            const changes: FieldChange[] = [];
            const existingUnit = existingItem.unitCode.trim().toUpperCase();
            const newUnit = item.unitCode.trim().toUpperCase();
            if (existingUnit !== newUnit) {
              changes.push({
                field: "unit",
                from: existingUnit,
                to: newUnit,
              });
            }
            const fromLabor = formatLaborUnits(Number(existingItem.laborUnits));
            const toLabor = formatLaborUnits(item.laborUnits);
            if (fromLabor !== toLabor) {
              changes.push({
                field: "laborUnits",
                from: fromLabor,
                to: toLabor,
              });
            }
            if (!notesEqual(existingItem.laborUnitNotes, item.laborUnitNotes)) {
              changes.push({
                field: "laborUnitNotes",
                from: existingItem.laborUnitNotes ?? "",
                to: item.laborUnitNotes ?? "",
              });
            }
            if (changes.length > 0) {
              itemUpdates.push({
                id: existingItem.id,
                name: item.name,
                domainSlug: resolvedDomainSlug,
                categorySlug: existingCat.slug,
                unitCode: newUnit,
                laborUnits: item.laborUnits,
                laborUnitNotes: item.laborUnitNotes,
                changes,
                sheet: item.sheet,
                row: item.row,
              });
            } else {
              unchangedItemCount += 1;
            }
            continue;
          }
        }

        itemCreates.push({
          domainSlug: resolvedDomainSlug,
          categorySlug: existingCat?.slug ?? catSlug,
          name: item.name,
          unitCode: item.unitCode.trim().toUpperCase(),
          laborUnits: item.laborUnits,
          laborUnitNotes: item.laborUnitNotes,
          sheet: item.sheet,
          row: item.row,
        });
      }
    }
  }

  return {
    domainCreates,
    categoryCreates,
    unitCreates,
    itemCreates,
    itemUpdates,
    unchangedItemCount,
    warnings,
    sheetsTotal: parsed.sheetsTotal,
    sheetsMatched: parsed.sheetsMatched,
    layoutOk: true,
    layoutMessage: null,
  };
}

export function summarizePlan(plan: ImportPlan) {
  return {
    domainsCreated: plan.domainCreates.length,
    categoriesCreated: plan.categoryCreates.length,
    unitsCreated: plan.unitCreates.length,
    itemsCreated: plan.itemCreates.length,
    itemsUpdated: plan.itemUpdates.length,
    itemsUnchanged: plan.unchangedItemCount,
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

export function buildExportAoa(domains: ExportDomain[]): {
  sheetName: string;
  aoa: (string | number)[][];
}[] {
  const sorted = [...domains].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const used = new Set<string>();
  return sorted.map((domain) => {
    const aoa: (string | number)[][] = [];
    const cats = [...domain.categories].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i]!;
      aoa.push([cat.name]);
      aoa.push([...ITEM_HEADERS]);
      const items = [...cat.items].sort((a, b) => a.name.localeCompare(b.name));
      for (const item of items) {
        aoa.push([
          item.name,
          item.unitCode,
          item.laborUnits,
          item.laborUnitNotes ?? "",
        ]);
      }
      if (i < cats.length - 1) {
        aoa.push([]);
      }
    }
    return {
      sheetName: safeSheetName(domain.name, used),
      aoa: aoa.length ? aoa : [[]],
    };
  });
}

export async function buildExportWorkbookBuffer(
  domains: ExportDomain[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheets = buildExportAoa(domains);
  if (sheets.length === 0) {
    wb.addWorksheet("Empty");
  } else {
    for (const { sheetName, aoa } of sheets) {
      const ws = wb.addWorksheet(sheetName);
      for (const row of aoa) {
        ws.addRow(row);
      }
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
