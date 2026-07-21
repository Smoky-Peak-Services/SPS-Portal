import { company } from "@/config/company";
import type { Segment } from "@prisma/client";
import {
  listCustomerScopes,
  resolveStorageScope,
  scopeCodeFor,
  toPrismaSegment,
} from "./scope";

export {
  scopeCodeFor,
  resolveStorageScope,
  toPrismaSegment,
  listCustomerScopes,
};

const ABBREV_TO_SEGMENT: Record<string, Segment> = {
  COM: "COMMERCIAL",
  RES: "RESIDENTIAL",
  STR: "STR",
};

export function segmentFromAbbrev(abbrev: string): Segment | null {
  return ABBREV_TO_SEGMENT[abbrev.toUpperCase()] ?? null;
}

export function listScopeCodes(): {
  code: string;
  divisionSlug: string;
  divisionCode: string;
  segment: Segment;
  /** Prisma storage segment for reads/writes (always equals segment). */
  storageSegment: Segment;
  label: string;
}[] {
  return listCustomerScopes().map((s) => ({
    code: s.scopeCode,
    divisionSlug: s.divisionSlug,
    divisionCode: s.divisionCode,
    segment: s.customerSegment,
    storageSegment: s.storageSegment,
    label: s.label,
  }));
}

/**
 * Parse `catalog_IS_COM_2026-07-08.xlsx` → { divisionCode, segment, date? }.
 * Returns null if the filename does not match a known customer scope.
 */
export function parseScopeFromFilename(filename: string): {
  scopeCode: string;
  divisionCode: string;
  segment: Segment;
  storageSegment: Segment;
  date?: string;
} | null {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.xlsx?$/i, "");
  const m = /^catalog_([A-Z0-9]+)_([A-Z]+)(?:_(\d{4}-\d{2}-\d{2}))?$/i.exec(
    base,
  );
  if (!m) return null;
  const divisionCode = m[1]!.toUpperCase();
  const segment = segmentFromAbbrev(m[2]!);
  if (!segment) return null;
  const known = listScopeCodes().find(
    (s) =>
      s.divisionCode.toUpperCase() === divisionCode && s.segment === segment,
  );
  if (!known) return null;
  return {
    scopeCode: known.code,
    divisionCode: known.divisionCode,
    segment: known.segment,
    storageSegment: known.storageSegment,
    date: m[3],
  };
}

export function exportFileName(scopeCode: string, date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10);
  return `catalog_${scopeCode}_${ymd}.xlsx`;
}

export function divisionSlugForCode(code: string): string | undefined {
  return company.divisions.find(
    (d) => d.code.toUpperCase() === code.toUpperCase(),
  )?.slug;
}
