/**
 * Flat Categories tax/linkage Excel import/export — pure logic, no Prisma.
 *
 * Sheet "Categories": one row per category (bulk-edit friendly).
 * Sheet "Stripe Tax Code Reference": small copy/paste reference.
 *
 * Never creates domains/categories. taxProfile is export-only (derived on write).
 * Blank tax code FK cells mean set to null. Invalid codes are flagged, not written.
 */
import type { MaterialTaxProfile } from "@prisma/client";
import ExcelJS from "exceljs";
import { safeSheetName, worksheetToAoa } from "./io";
import { nameMatchKey, normalizeName, slugify } from "./normalize";
import {
  CANONICAL_LABOR_TAX_DEFAULTS,
  deriveTaxProfileFromStripeCode,
  NONTAXABLE_TAX_CODE_ID,
  PARTS_SALE_TAX_CODE_ID,
} from "./tax";

export const CATEGORIES_SHEET = "Categories";
export const TAX_REF_SHEET = "Stripe Tax Code Reference";

export const CATEGORY_TAX_HEADERS = [
  "domain",
  "category",
  "slug",
  "taxProfile",
  "taxReviewed",
  "stripeTaxCodeId",
  "stripeTaxCodeName",
  "laborInstallTaxCodeId",
  "laborInstallTaxCodeName",
  "laborServiceTaxCodeId",
  "laborServiceTaxCodeName",
] as const;

export const TAX_REF_HEADERS = ["id", "name", "description"] as const;

export type CatTaxRowWarning = {
  sheet: string;
  row: number;
  message: string;
};

export type ExportCategoryTaxRow = {
  domain: string;
  category: string;
  slug: string;
  taxProfile: string;
  taxReviewed: boolean;
  stripeTaxCodeId: string | null;
  stripeTaxCodeName: string | null;
  laborInstallTaxCodeId: string | null;
  laborInstallTaxCodeName: string | null;
  laborServiceTaxCodeId: string | null;
  laborServiceTaxCodeName: string | null;
};

export type StripeTaxCodeRef = {
  id: string;
  name: string;
  description: string | null;
};

export type ExistingCategoryTax = {
  id: string;
  domainId: string;
  domainName: string;
  domainSlug: string;
  name: string;
  slug: string;
  taxProfile: MaterialTaxProfile;
  taxReviewed: boolean;
  stripeTaxCodeId: string | null;
  laborInstallTaxCodeId: string | null;
  laborServiceTaxCodeId: string | null;
};

export type ExistingCategoryTaxSnapshot = {
  categories: ExistingCategoryTax[];
  /** Valid StripeTaxCode ids for validation. */
  validTaxCodeIds: Set<string>;
};

export type CatTaxFieldChange = {
  field:
    | "taxReviewed"
    | "stripeTaxCodeId"
    | "laborInstallTaxCodeId"
    | "laborServiceTaxCodeId"
    | "taxProfile";
  from: string;
  to: string;
};

export type PlannedCategoryTaxUpdate = {
  id: string;
  domain: string;
  category: string;
  row: number;
  taxReviewed?: boolean;
  stripeTaxCodeId?: string | null;
  laborInstallTaxCodeId?: string | null;
  laborServiceTaxCodeId?: string | null;
  /** Always set when any tax code field is applied. */
  taxProfile?: MaterialTaxProfile;
  changes: CatTaxFieldChange[];
};

export type CategoryTaxImportPlan = {
  updates: PlannedCategoryTaxUpdate[];
  unchangedCount: number;
  unresolved: { domain: string; category: string; row: number }[];
  warnings: CatTaxRowWarning[];
  layoutOk: boolean;
  layoutMessage: string | null;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function headerIndex(headerRow: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const key = str(cell).toLowerCase();
    if (key) m.set(key, i);
  });
  return m;
}

function parseBool(raw: string): boolean | null {
  const t = raw.trim().toLowerCase();
  if (t === "true" || t === "1" || t === "yes") return true;
  if (t === "false" || t === "0" || t === "no") return false;
  return null;
}

function displayCode(id: string | null | undefined): string {
  return id?.trim() || "";
}

/** Build reference id set for the small reference sheet. */
export function collectReferenceTaxCodeIds(
  usedIds: Iterable<string | null | undefined>,
): string[] {
  const set = new Set<string>();
  set.add(NONTAXABLE_TAX_CODE_ID);
  set.add(PARTS_SALE_TAX_CODE_ID);
  for (const row of CANONICAL_LABOR_TAX_DEFAULTS) {
    set.add(row.stripeTaxCodeId);
  }
  for (const id of usedIds) {
    if (id?.trim()) set.add(id.trim());
  }
  return [...set].sort();
}

export function buildCategoryTaxExportAoa(
  rows: ExportCategoryTaxRow[],
): unknown[][] {
  const aoa: unknown[][] = [[...CATEGORY_TAX_HEADERS]];
  for (const r of rows) {
    aoa.push([
      r.domain,
      r.category,
      r.slug,
      r.taxProfile,
      r.taxReviewed ? "true" : "false",
      r.stripeTaxCodeId ?? "",
      r.stripeTaxCodeName ?? "",
      r.laborInstallTaxCodeId ?? "",
      r.laborInstallTaxCodeName ?? "",
      r.laborServiceTaxCodeId ?? "",
      r.laborServiceTaxCodeName ?? "",
    ]);
  }
  return aoa;
}

export function buildTaxRefExportAoa(refs: StripeTaxCodeRef[]): unknown[][] {
  const aoa: unknown[][] = [[...TAX_REF_HEADERS]];
  for (const r of refs) {
    aoa.push([r.id, r.name, r.description ?? ""]);
  }
  return aoa;
}

export async function buildCategoryTaxWorkbookBuffer(args: {
  categories: ExportCategoryTaxRow[];
  taxRefs: StripeTaxCodeRef[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>();
  const cat = wb.addWorksheet(safeSheetName(CATEGORIES_SHEET, used));
  for (const row of buildCategoryTaxExportAoa(args.categories)) {
    cat.addRow(row);
  }
  const ref = wb.addWorksheet(safeSheetName(TAX_REF_SHEET, used));
  for (const row of buildTaxRefExportAoa(args.taxRefs)) {
    ref.addRow(row);
  }
  const help = wb.addWorksheet(safeSheetName("Instructions", used));
  help.addRow(["Categories tax / linkage bulk edit"]);
  help.addRow([]);
  help.addRow([
    "Re-export a fresh file before importing. Blank tax code cells set that override to null.",
  ]);
  help.addRow([
    "taxProfile is derived from stripeTaxCodeId (txcd_00000000 or blank → REAL_PROPERTY; else TPP) and is ignored on import.",
  ]);
  help.addRow([
    "slug and *Name columns are export-only. taxReviewed blank = leave unchanged.",
  ]);
  help.addRow([
    "Rows whose domain+category do not match an existing category are skipped (nothing is created).",
  ]);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type ParsedCategoryTaxRow = {
  domain: string;
  category: string;
  taxReviewedRaw: string;
  stripeTaxCodeId: string;
  laborInstallTaxCodeId: string;
  laborServiceTaxCodeId: string;
  row: number;
};

export type ParsedCategoryTaxWorkbook = {
  rows: ParsedCategoryTaxRow[];
  warnings: CatTaxRowWarning[];
  layoutOk: boolean;
  layoutMessage: string | null;
};

export function parseCategoryTaxAoa(aoa: unknown[][]): ParsedCategoryTaxWorkbook {
  const warnings: CatTaxRowWarning[] = [];
  if (aoa.length < 1) {
    return {
      rows: [],
      warnings,
      layoutOk: false,
      layoutMessage: "Categories sheet is empty",
    };
  }

  const idx = headerIndex(aoa[0] ?? []);
  const need = ["domain", "category", "taxreviewed", "stripetaxcodeid"];
  for (const h of need) {
    if (!idx.has(h) && h === "taxreviewed") {
      // allow missing taxReviewed? require it
    }
  }
  if (!idx.has("domain") || !idx.has("category")) {
    return {
      rows: [],
      warnings,
      layoutOk: false,
      layoutMessage:
        "Categories sheet missing required headers: domain, category",
    };
  }

  const rows: ParsedCategoryTaxRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const line = aoa[r] ?? [];
    const domain = normalizeName(str(line[idx.get("domain")!]));
    const category = normalizeName(str(line[idx.get("category")!]));
    if (!domain && !category) continue;
    if (!domain || !category) {
      warnings.push({
        sheet: CATEGORIES_SHEET,
        row: r + 1,
        message: "Row missing domain or category — skipped",
      });
      continue;
    }
    rows.push({
      domain,
      category,
      taxReviewedRaw: idx.has("taxreviewed")
        ? str(line[idx.get("taxreviewed")!])
        : "",
      stripeTaxCodeId: idx.has("stripetaxcodeid")
        ? str(line[idx.get("stripetaxcodeid")!])
        : "",
      laborInstallTaxCodeId: idx.has("laborinstalltaxcodeid")
        ? str(line[idx.get("laborinstalltaxcodeid")!])
        : "",
      laborServiceTaxCodeId: idx.has("laborservicetaxcodeid")
        ? str(line[idx.get("laborservicetaxcodeid")!])
        : "",
      row: r + 1,
    });
  }

  return {
    rows,
    warnings,
    layoutOk: true,
    layoutMessage: null,
  };
}

export async function parseCategoryTaxWorkbookBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedCategoryTaxWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const ws = wb.worksheets.find(
    (s) => nameMatchKey(s.name) === nameMatchKey(CATEGORIES_SHEET),
  );
  if (!ws) {
    return {
      rows: [],
      warnings: [],
      layoutOk: false,
      layoutMessage: `Missing "${CATEGORIES_SHEET}" sheet`,
    };
  }
  return parseCategoryTaxAoa(worksheetToAoa(ws));
}

function findCategory(
  existing: ExistingCategoryTaxSnapshot,
  domain: string,
  category: string,
): ExistingCategoryTax | undefined {
  const dKey = nameMatchKey(domain);
  const dSlug = slugify(domain).toLowerCase();
  const cKey = nameMatchKey(category);
  const cSlug = slugify(category).toLowerCase();

  return existing.categories.find((c) => {
    const domainOk =
      nameMatchKey(c.domainName) === dKey ||
      c.domainSlug.toLowerCase() === dSlug ||
      c.domainSlug.toLowerCase() === dKey;
    if (!domainOk) return false;
    return (
      nameMatchKey(c.name) === cKey ||
      c.slug.toLowerCase() === cSlug ||
      c.slug.toLowerCase() === cKey
    );
  });
}

function resolveTaxCodeField(
  raw: string,
  valid: Set<string>,
  fieldLabel: string,
  row: number,
  warnings: CatTaxRowWarning[],
): { apply: boolean; value: string | null } {
  // Always apply: blank → null, valid → id, invalid → skip write
  if (!raw) {
    return { apply: true, value: null };
  }
  if (!valid.has(raw)) {
    warnings.push({
      sheet: CATEGORIES_SHEET,
      row,
      message: `Unknown ${fieldLabel} "${raw}" — left unchanged`,
    });
    return { apply: false, value: null };
  }
  return { apply: true, value: raw };
}

export function planCategoryTaxImport(
  existing: ExistingCategoryTaxSnapshot,
  parsed: ParsedCategoryTaxWorkbook,
): CategoryTaxImportPlan {
  const warnings = [...parsed.warnings];
  if (!parsed.layoutOk) {
    return {
      updates: [],
      unchangedCount: 0,
      unresolved: [],
      warnings,
      layoutOk: false,
      layoutMessage: parsed.layoutMessage,
    };
  }

  const updates: PlannedCategoryTaxUpdate[] = [];
  const unresolved: CategoryTaxImportPlan["unresolved"] = [];
  let unchangedCount = 0;

  for (const row of parsed.rows) {
    const match = findCategory(existing, row.domain, row.category);
    if (!match) {
      unresolved.push({
        domain: row.domain,
        category: row.category,
        row: row.row,
      });
      warnings.push({
        sheet: CATEGORIES_SHEET,
        row: row.row,
        message: `Unresolved category "${row.domain}" / "${row.category}" — skipped (nothing created)`,
      });
      continue;
    }

    const changes: CatTaxFieldChange[] = [];
    const planned: PlannedCategoryTaxUpdate = {
      id: match.id,
      domain: row.domain,
      category: row.category,
      row: row.row,
      changes,
    };

    // taxReviewed
    if (row.taxReviewedRaw === "") {
      warnings.push({
        sheet: CATEGORIES_SHEET,
        row: row.row,
        message: "taxReviewed blank — left unchanged",
      });
    } else {
      const b = parseBool(row.taxReviewedRaw);
      if (b == null) {
        warnings.push({
          sheet: CATEGORIES_SHEET,
          row: row.row,
          message: `taxReviewed "${row.taxReviewedRaw}" invalid — left unchanged`,
        });
      } else if (b !== match.taxReviewed) {
        planned.taxReviewed = b;
        changes.push({
          field: "taxReviewed",
          from: String(match.taxReviewed),
          to: String(b),
        });
      }
    }

    const material = resolveTaxCodeField(
      row.stripeTaxCodeId,
      existing.validTaxCodeIds,
      "stripeTaxCodeId",
      row.row,
      warnings,
    );
    const install = resolveTaxCodeField(
      row.laborInstallTaxCodeId,
      existing.validTaxCodeIds,
      "laborInstallTaxCodeId",
      row.row,
      warnings,
    );
    const service = resolveTaxCodeField(
      row.laborServiceTaxCodeId,
      existing.validTaxCodeIds,
      "laborServiceTaxCodeId",
      row.row,
      warnings,
    );

    let nextStripe = match.stripeTaxCodeId;
    if (material.apply) {
      const from = displayCode(match.stripeTaxCodeId);
      const to = displayCode(material.value);
      if (from !== to) {
        planned.stripeTaxCodeId = material.value;
        nextStripe = material.value;
        changes.push({ field: "stripeTaxCodeId", from, to });
      }
    }
    if (install.apply) {
      const from = displayCode(match.laborInstallTaxCodeId);
      const to = displayCode(install.value);
      if (from !== to) {
        planned.laborInstallTaxCodeId = install.value;
        changes.push({ field: "laborInstallTaxCodeId", from, to });
      }
    }
    if (service.apply) {
      const from = displayCode(match.laborServiceTaxCodeId);
      const to = displayCode(service.value);
      if (from !== to) {
        planned.laborServiceTaxCodeId = service.value;
        changes.push({ field: "laborServiceTaxCodeId", from, to });
      }
    }

    // Derive taxProfile whenever material code is applied (including no-op null round-trip)
    // or when stripe changed. Always re-derive if stripe field was applied.
    if (material.apply) {
      const derived = deriveTaxProfileFromStripeCode(nextStripe);
      if (derived !== match.taxProfile) {
        planned.taxProfile = derived;
        changes.push({
          field: "taxProfile",
          from: match.taxProfile,
          to: derived,
        });
      } else if (planned.stripeTaxCodeId !== undefined) {
        // Keep denormalized column in sync even if same
        planned.taxProfile = derived;
      }
    }

    if (changes.length === 0) {
      unchangedCount += 1;
    } else {
      updates.push(planned);
    }
  }

  return {
    updates,
    unchangedCount,
    unresolved,
    warnings,
    layoutOk: true,
    layoutMessage: null,
  };
}

export function summarizeCategoryTaxPlan(plan: CategoryTaxImportPlan) {
  return {
    updates: plan.updates.length,
    unchanged: plan.unchangedCount,
    unresolved: plan.unresolved.length,
    warnings: plan.warnings.length,
    layoutOk: plan.layoutOk,
    layoutMessage: plan.layoutMessage,
  };
}
