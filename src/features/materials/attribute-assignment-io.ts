/**
 * Flat Attribute Assignments Excel import/export — pure logic, no Prisma.
 *
 * Sheet "Attribute Assignments": one row per (category, attribute) pair.
 * Upsert only — never deletes assignments missing from the file.
 */
import ExcelJS from "exceljs";
import { safeSheetName, worksheetToAoa } from "./io";
import { nameMatchKey, normalizeName, slugify } from "./normalize";

export const ASSIGNMENTS_SHEET = "Attribute Assignments";

export const ASSIGNMENT_HEADERS = [
  "domain",
  "category",
  "attribute",
  "isRequired",
  "isFilterable",
  "isVariantDefining",
  "defaultOption",
  "sortOrder",
] as const;

export type AssignRowWarning = {
  sheet: string;
  row: number;
  message: string;
};

export type ExportAssignmentRow = {
  domain: string;
  category: string;
  attribute: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantDefining: boolean;
  defaultOption: string | null;
  sortOrder: number;
};

export type ExistingAssignmentCategory = {
  id: string;
  name: string;
  slug: string;
  domainName: string;
  domainSlug: string;
};

export type ExistingAssignmentAttribute = {
  id: string;
  name: string;
  slug: string;
  options: { id: string; label: string }[];
};

export type ExistingAssignment = {
  id: string;
  categoryId: string;
  attributeId: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantDefining: boolean;
  defaultOptionId: string | null;
  defaultOptionLabel: string | null;
  sortOrder: number;
};

export type ExistingAssignmentSnapshot = {
  categories: ExistingAssignmentCategory[];
  attributes: ExistingAssignmentAttribute[];
  assignments: ExistingAssignment[];
};

export type AssignFieldChange = {
  field:
    | "isRequired"
    | "isFilterable"
    | "isVariantDefining"
    | "defaultOption"
    | "sortOrder";
  from: string;
  to: string;
};

export type PlannedAssignmentCreate = {
  categoryId: string;
  attributeId: string;
  domain: string;
  category: string;
  attribute: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantDefining: boolean;
  defaultOptionId: string | null;
  sortOrder: number;
  row: number;
};

export type PlannedAssignmentUpdate = {
  id: string;
  domain: string;
  category: string;
  attribute: string;
  isRequired?: boolean;
  isFilterable?: boolean;
  isVariantDefining?: boolean;
  defaultOptionId?: string | null;
  sortOrder?: number;
  changes: AssignFieldChange[];
  row: number;
};

export type AssignmentImportPlan = {
  creates: PlannedAssignmentCreate[];
  updates: PlannedAssignmentUpdate[];
  unchangedCount: number;
  unresolved: { domain: string; category: string; attribute: string; row: number }[];
  warnings: AssignRowWarning[];
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

function parseBool(raw: string, fallback: boolean): { value: boolean; ok: boolean } {
  const t = raw.trim().toLowerCase();
  if (t === "") return { value: fallback, ok: false };
  if (t === "true" || t === "1" || t === "yes") return { value: true, ok: true };
  if (t === "false" || t === "0" || t === "no") return { value: false, ok: true };
  return { value: fallback, ok: false };
}

function parseSortOrder(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function buildAssignmentExportAoa(
  rows: ExportAssignmentRow[],
): unknown[][] {
  const aoa: unknown[][] = [[...ASSIGNMENT_HEADERS]];
  for (const r of rows) {
    aoa.push([
      r.domain,
      r.category,
      r.attribute,
      r.isRequired ? "true" : "false",
      r.isFilterable ? "true" : "false",
      r.isVariantDefining ? "true" : "false",
      r.defaultOption ?? "",
      r.sortOrder,
    ]);
  }
  return aoa;
}

export async function buildAssignmentWorkbookBuffer(
  rows: ExportAssignmentRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>();
  const ws = wb.addWorksheet(safeSheetName(ASSIGNMENTS_SHEET, used));
  for (const row of buildAssignmentExportAoa(rows)) {
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type ParsedAssignmentRow = {
  domain: string;
  category: string;
  attribute: string;
  isRequiredRaw: string;
  isFilterableRaw: string;
  isVariantDefiningRaw: string;
  defaultOption: string;
  sortOrderRaw: string;
  row: number;
};

export type ParsedAssignmentWorkbook = {
  rows: ParsedAssignmentRow[];
  warnings: AssignRowWarning[];
  layoutOk: boolean;
  layoutMessage: string | null;
};

export function parseAssignmentAoa(aoa: unknown[][]): ParsedAssignmentWorkbook {
  const warnings: AssignRowWarning[] = [];
  if (aoa.length < 1) {
    return {
      rows: [],
      warnings,
      layoutOk: false,
      layoutMessage: "Attribute Assignments sheet is empty",
    };
  }
  const idx = headerIndex(aoa[0] ?? []);
  for (const h of ["domain", "category", "attribute"]) {
    if (!idx.has(h)) {
      return {
        rows: [],
        warnings,
        layoutOk: false,
        layoutMessage: `Missing required header: ${h}`,
      };
    }
  }

  const rows: ParsedAssignmentRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const line = aoa[r] ?? [];
    const domain = normalizeName(str(line[idx.get("domain")!]));
    const category = normalizeName(str(line[idx.get("category")!]));
    const attribute = normalizeName(str(line[idx.get("attribute")!]));
    if (!domain && !category && !attribute) continue;
    if (!domain || !category || !attribute) {
      warnings.push({
        sheet: ASSIGNMENTS_SHEET,
        row: r + 1,
        message: "Row missing domain, category, or attribute — skipped",
      });
      continue;
    }
    rows.push({
      domain,
      category,
      attribute,
      isRequiredRaw: idx.has("isrequired")
        ? str(line[idx.get("isrequired")!])
        : "",
      isFilterableRaw: idx.has("isfilterable")
        ? str(line[idx.get("isfilterable")!])
        : "",
      isVariantDefiningRaw: idx.has("isvariantdefining")
        ? str(line[idx.get("isvariantdefining")!])
        : "",
      defaultOption: idx.has("defaultoption")
        ? str(line[idx.get("defaultoption")!])
        : "",
      sortOrderRaw: idx.has("sortorder") ? str(line[idx.get("sortorder")!]) : "",
      row: r + 1,
    });
  }

  return { rows, warnings, layoutOk: true, layoutMessage: null };
}

export async function parseAssignmentWorkbookBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedAssignmentWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const ws = wb.worksheets.find(
    (s) => nameMatchKey(s.name) === nameMatchKey(ASSIGNMENTS_SHEET),
  );
  if (!ws) {
    return {
      rows: [],
      warnings: [],
      layoutOk: false,
      layoutMessage: `Missing "${ASSIGNMENTS_SHEET}" sheet`,
    };
  }
  return parseAssignmentAoa(worksheetToAoa(ws));
}

function findCategory(
  existing: ExistingAssignmentSnapshot,
  domain: string,
  category: string,
): ExistingAssignmentCategory | undefined {
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

function findAttribute(
  existing: ExistingAssignmentSnapshot,
  attribute: string,
): ExistingAssignmentAttribute | undefined {
  const key = nameMatchKey(attribute);
  const slug = slugify(attribute).toLowerCase();
  return existing.attributes.find(
    (a) =>
      nameMatchKey(a.name) === key ||
      a.slug.toLowerCase() === slug ||
      a.slug.toLowerCase() === key,
  );
}

function findOptionId(
  attr: ExistingAssignmentAttribute,
  label: string,
): string | null | undefined {
  // undefined = blank (clear); null = not found
  if (!label.trim()) return undefined; // signal blank → null default
  const key = nameMatchKey(label);
  const opt = attr.options.find((o) => nameMatchKey(o.label) === key);
  return opt?.id ?? null;
}

export function planAssignmentImport(
  existing: ExistingAssignmentSnapshot,
  parsed: ParsedAssignmentWorkbook,
): AssignmentImportPlan {
  const warnings = [...parsed.warnings];
  if (!parsed.layoutOk) {
    return {
      creates: [],
      updates: [],
      unchangedCount: 0,
      unresolved: [],
      warnings,
      layoutOk: false,
      layoutMessage: parsed.layoutMessage,
    };
  }

  const byPair = new Map<string, ExistingAssignment>();
  for (const a of existing.assignments) {
    byPair.set(`${a.categoryId}|${a.attributeId}`, a);
  }

  const creates: PlannedAssignmentCreate[] = [];
  const updates: PlannedAssignmentUpdate[] = [];
  const unresolved: AssignmentImportPlan["unresolved"] = [];
  let unchangedCount = 0;

  for (const row of parsed.rows) {
    const cat = findCategory(existing, row.domain, row.category);
    const attr = findAttribute(existing, row.attribute);
    if (!cat || !attr) {
      unresolved.push({
        domain: row.domain,
        category: row.category,
        attribute: row.attribute,
        row: row.row,
      });
      warnings.push({
        sheet: ASSIGNMENTS_SHEET,
        row: row.row,
        message: `Unresolved ${!cat ? "category" : "attribute"} "${row.domain}" / "${row.category}" / "${row.attribute}" — skipped`,
      });
      continue;
    }

    const isRequired = parseBool(row.isRequiredRaw, false);
    const isFilterable = parseBool(row.isFilterableRaw, true);
    const isVariantDefining = parseBool(row.isVariantDefiningRaw, false);
    if (row.isRequiredRaw && !isRequired.ok) {
      warnings.push({
        sheet: ASSIGNMENTS_SHEET,
        row: row.row,
        message: `isRequired "${row.isRequiredRaw}" invalid — using false for create / leave on update`,
      });
    }
    if (row.isFilterableRaw && !isFilterable.ok) {
      warnings.push({
        sheet: ASSIGNMENTS_SHEET,
        row: row.row,
        message: `isFilterable "${row.isFilterableRaw}" invalid — using true for create / leave on update`,
      });
    }
    if (row.isVariantDefiningRaw && !isVariantDefining.ok) {
      warnings.push({
        sheet: ASSIGNMENTS_SHEET,
        row: row.row,
        message: `isVariantDefining "${row.isVariantDefiningRaw}" invalid — using false for create / leave on update`,
      });
    }

    let sortOrder = 0;
    if (row.sortOrderRaw === "") {
      sortOrder = 0;
    } else {
      const parsedSort = parseSortOrder(row.sortOrderRaw);
      if (parsedSort == null) {
        warnings.push({
          sheet: ASSIGNMENTS_SHEET,
          row: row.row,
          message: `sortOrder "${row.sortOrderRaw}" invalid — using 0 for create / leave on update`,
        });
        sortOrder = 0;
      } else {
        sortOrder = parsedSort;
      }
    }

    const optionResult = findOptionId(attr, row.defaultOption);
    let defaultOptionId: string | null | undefined;
    if (row.defaultOption === "") {
      defaultOptionId = null;
    } else if (optionResult === null) {
      warnings.push({
        sheet: ASSIGNMENTS_SHEET,
        row: row.row,
        message: `Unknown defaultOption "${row.defaultOption}" — left unchanged`,
      });
      defaultOptionId = undefined; // skip field
    } else {
      defaultOptionId = optionResult;
    }

    const existingAssign = byPair.get(`${cat.id}|${attr.id}`);
    if (!existingAssign) {
      creates.push({
        categoryId: cat.id,
        attributeId: attr.id,
        domain: row.domain,
        category: row.category,
        attribute: row.attribute,
        isRequired: isRequired.ok ? isRequired.value : false,
        isFilterable: isFilterable.ok ? isFilterable.value : true,
        isVariantDefining: isVariantDefining.ok
          ? isVariantDefining.value
          : false,
        defaultOptionId:
          defaultOptionId === undefined ? null : defaultOptionId,
        sortOrder: row.sortOrderRaw === "" || parseSortOrder(row.sortOrderRaw) == null
          ? 0
          : sortOrder,
        row: row.row,
      });
      continue;
    }

    const changes: AssignFieldChange[] = [];
    const planned: PlannedAssignmentUpdate = {
      id: existingAssign.id,
      domain: row.domain,
      category: row.category,
      attribute: row.attribute,
      changes,
      row: row.row,
    };

    if (isRequired.ok && isRequired.value !== existingAssign.isRequired) {
      planned.isRequired = isRequired.value;
      changes.push({
        field: "isRequired",
        from: String(existingAssign.isRequired),
        to: String(isRequired.value),
      });
    }
    if (isFilterable.ok && isFilterable.value !== existingAssign.isFilterable) {
      planned.isFilterable = isFilterable.value;
      changes.push({
        field: "isFilterable",
        from: String(existingAssign.isFilterable),
        to: String(isFilterable.value),
      });
    }
    if (
      isVariantDefining.ok &&
      isVariantDefining.value !== existingAssign.isVariantDefining
    ) {
      planned.isVariantDefining = isVariantDefining.value;
      changes.push({
        field: "isVariantDefining",
        from: String(existingAssign.isVariantDefining),
        to: String(isVariantDefining.value),
      });
    }
    if (
      row.sortOrderRaw !== "" &&
      parseSortOrder(row.sortOrderRaw) != null &&
      sortOrder !== existingAssign.sortOrder
    ) {
      planned.sortOrder = sortOrder;
      changes.push({
        field: "sortOrder",
        from: String(existingAssign.sortOrder),
        to: String(sortOrder),
      });
    }
    if (defaultOptionId !== undefined) {
      const from = existingAssign.defaultOptionLabel ?? "";
      const to =
        defaultOptionId == null
          ? ""
          : (attr.options.find((o) => o.id === defaultOptionId)?.label ?? "");
      if ((existingAssign.defaultOptionId ?? null) !== defaultOptionId) {
        planned.defaultOptionId = defaultOptionId;
        changes.push({ field: "defaultOption", from, to });
      }
    }

    if (changes.length === 0) {
      unchangedCount += 1;
    } else {
      updates.push(planned);
    }
  }

  return {
    creates,
    updates,
    unchangedCount,
    unresolved,
    warnings,
    layoutOk: true,
    layoutMessage: null,
  };
}

export function summarizeAssignmentPlan(plan: AssignmentImportPlan) {
  return {
    creates: plan.creates.length,
    updates: plan.updates.length,
    unchanged: plan.unchangedCount,
    unresolved: plan.unresolved.length,
    warnings: plan.warnings.length,
    layoutOk: plan.layoutOk,
    layoutMessage: plan.layoutMessage,
  };
}
