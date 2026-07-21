/**
 * Flat Domains Excel import/export — pure logic, no Prisma.
 * Sheet "Domains": division | segment | name | slug | sortOrder
 * slug is export-only / ignored on import (derived from name on create).
 */
import ExcelJS from "exceljs";
import type { Segment } from "@prisma/client";
import { safeSheetName, worksheetToAoa } from "./io";
import { nameMatchKey, normalizeName, slugify } from "./normalize";

export const DOMAINS_SHEET = "Domains";
export const DOMAIN_HEADERS = [
  "division",
  "segment",
  "name",
  "slug",
  "sortOrder",
] as const;

const SEGMENTS = new Set(["COMMERCIAL", "RESIDENTIAL", "STR"]);

export type DomainRowWarning = {
  sheet: string;
  row: number;
  message: string;
};

export type ExportDomainRow = {
  division: string;
  segment: Segment;
  name: string;
  slug: string;
  sortOrder: number;
};

export type ExistingDomainRow = {
  id: string;
  divisionId: string;
  divisionName: string;
  divisionSlug: string;
  segment: Segment;
  name: string;
  slug: string;
  sortOrder: number;
};

export type ExistingDomainSnapshot = {
  domains: ExistingDomainRow[];
  divisions: { id: string; name: string; slug: string }[];
};

export type PlannedDomainFlatCreate = {
  divisionId: string;
  segment: Segment;
  name: string;
  slug: string;
  sortOrder: number;
  row: number;
};

export type PlannedDomainFlatUpdate = {
  id: string;
  name?: string;
  sortOrder?: number;
  changes: { field: "name" | "sortOrder"; from: string; to: string }[];
  row: number;
};

export type DomainFlatImportPlan = {
  creates: PlannedDomainFlatCreate[];
  updates: PlannedDomainFlatUpdate[];
  unchangedCount: number;
  unresolved: { division: string; segment: string; name: string; row: number }[];
  warnings: DomainRowWarning[];
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

function parseSegment(raw: string): Segment | null {
  const u = raw.trim().toUpperCase();
  if (SEGMENTS.has(u)) return u as Segment;
  return null;
}

export function buildDomainExportAoa(rows: ExportDomainRow[]): unknown[][] {
  const aoa: unknown[][] = [[...DOMAIN_HEADERS]];
  for (const r of rows) {
    aoa.push([r.division, r.segment, r.name, r.slug, r.sortOrder]);
  }
  return aoa;
}

export async function buildDomainWorkbookBuffer(
  rows: ExportDomainRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>();
  const ws = wb.addWorksheet(safeSheetName(DOMAINS_SHEET, used));
  for (const row of buildDomainExportAoa(rows)) {
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type ParsedDomainFlatRow = {
  division: string;
  segment: Segment;
  name: string;
  sortOrder: number;
  row: number;
};

export type ParsedDomainFlatWorkbook = {
  rows: ParsedDomainFlatRow[];
  warnings: DomainRowWarning[];
  layoutOk: boolean;
  layoutMessage: string | null;
};

export function parseDomainFlatAoa(aoa: unknown[][]): ParsedDomainFlatWorkbook {
  const warnings: DomainRowWarning[] = [];
  if (aoa.length < 1) {
    return {
      rows: [],
      warnings,
      layoutOk: false,
      layoutMessage: "Domains sheet is empty",
    };
  }
  const idx = headerIndex(aoa[0] ?? []);
  if (!idx.has("division") || !idx.has("segment") || !idx.has("name")) {
    return {
      rows: [],
      warnings,
      layoutOk: false,
      layoutMessage: "Missing required headers: division, segment, name",
    };
  }

  const rows: ParsedDomainFlatRow[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const line = aoa[r] ?? [];
    const division = normalizeName(str(line[idx.get("division")!]));
    const segmentRaw = str(line[idx.get("segment")!]);
    const name = normalizeName(str(line[idx.get("name")!]));
    if (!division && !segmentRaw && !name) continue;
    const segment = parseSegment(segmentRaw);
    if (!division || !name || !segment) {
      warnings.push({
        sheet: DOMAINS_SHEET,
        row: r + 1,
        message: "Row missing division/segment/name or invalid segment — skipped",
      });
      continue;
    }
    let sortOrder = 0;
    if (idx.has("sortorder")) {
      const raw = str(line[idx.get("sortorder")!]);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) sortOrder = Math.trunc(n);
        else {
          warnings.push({
            sheet: DOMAINS_SHEET,
            row: r + 1,
            message: `Invalid sortOrder "${raw}" — using 0`,
          });
        }
      }
    }
    rows.push({ division, segment, name, sortOrder, row: r + 1 });
  }

  return { rows, warnings, layoutOk: true, layoutMessage: null };
}

export async function parseDomainFlatWorkbookBuffer(
  buffer: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedDomainFlatWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const ws = wb.worksheets.find(
    (s) => nameMatchKey(s.name) === nameMatchKey(DOMAINS_SHEET),
  );
  if (!ws) {
    return {
      rows: [],
      warnings: [],
      layoutOk: false,
      layoutMessage: `Missing "${DOMAINS_SHEET}" sheet`,
    };
  }
  return parseDomainFlatAoa(worksheetToAoa(ws));
}

export function planDomainFlatImport(
  existing: ExistingDomainSnapshot,
  parsed: ParsedDomainFlatWorkbook,
): DomainFlatImportPlan {
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

  const divisionByKey = new Map<string, { id: string; name: string; slug: string }>();
  for (const d of existing.divisions) {
    divisionByKey.set(nameMatchKey(d.name), d);
    divisionByKey.set(d.slug.toLowerCase(), d);
  }

  const creates: PlannedDomainFlatCreate[] = [];
  const updates: PlannedDomainFlatUpdate[] = [];
  const unresolved: DomainFlatImportPlan["unresolved"] = [];
  let unchangedCount = 0;

  for (const row of parsed.rows) {
    const div =
      divisionByKey.get(nameMatchKey(row.division)) ??
      divisionByKey.get(slugify(row.division).toLowerCase());
    if (!div) {
      unresolved.push({
        division: row.division,
        segment: row.segment,
        name: row.name,
        row: row.row,
      });
      warnings.push({
        sheet: DOMAINS_SHEET,
        row: row.row,
        message: `Unknown division "${row.division}" — skipped`,
      });
      continue;
    }

    const match = existing.domains.find(
      (d) =>
        d.divisionId === div.id &&
        d.segment === row.segment &&
        (nameMatchKey(d.name) === nameMatchKey(row.name) ||
          d.slug.toLowerCase() === slugify(row.name).toLowerCase()),
    );

    if (!match) {
      creates.push({
        divisionId: div.id,
        segment: row.segment,
        name: row.name,
        slug: slugify(row.name),
        sortOrder: row.sortOrder,
        row: row.row,
      });
      continue;
    }

    const changes: PlannedDomainFlatUpdate["changes"] = [];
    const planned: PlannedDomainFlatUpdate = {
      id: match.id,
      changes,
      row: row.row,
    };
    if (normalizeName(match.name) !== row.name) {
      planned.name = row.name;
      changes.push({ field: "name", from: match.name, to: row.name });
    }
    if (match.sortOrder !== row.sortOrder) {
      planned.sortOrder = row.sortOrder;
      changes.push({
        field: "sortOrder",
        from: String(match.sortOrder),
        to: String(row.sortOrder),
      });
    }
    if (changes.length === 0) unchangedCount += 1;
    else updates.push(planned);
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

export function summarizeDomainFlatPlan(plan: DomainFlatImportPlan) {
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
