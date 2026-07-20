import { company } from "@/config/company";
import type { Segment } from "@prisma/client";

const SEGMENT_ABBREV: Record<Segment, string> = {
  COMMERCIAL: "COM",
  RESIDENTIAL: "RES",
  STR: "STR",
};

const ABBREV_TO_SEGMENT: Record<string, Segment> = {
  COM: "COMMERCIAL",
  RES: "RESIDENTIAL",
  STR: "STR",
};

/** e.g. Integrated Systems + COMMERCIAL → IS_COM */
export function scopeCodeFor(
  divisionCode: string,
  segment: Segment,
): string {
  return `${divisionCode.toUpperCase()}_${SEGMENT_ABBREV[segment]}`;
}

export function segmentFromAbbrev(abbrev: string): Segment | null {
  return ABBREV_TO_SEGMENT[abbrev.toUpperCase()] ?? null;
}

export function listScopeCodes(): {
  code: string;
  divisionSlug: string;
  divisionCode: string;
  segment: Segment;
  label: string;
}[] {
  const out: {
    code: string;
    divisionSlug: string;
    divisionCode: string;
    segment: Segment;
    label: string;
  }[] = [];
  for (const d of company.divisions) {
    for (const seg of d.segments) {
      const segment = (
        seg === "commercial"
          ? "COMMERCIAL"
          : seg === "residential"
            ? "RESIDENTIAL"
            : "STR"
      ) as Segment;
      out.push({
        code: scopeCodeFor(d.code, segment),
        divisionSlug: d.slug,
        divisionCode: d.code,
        segment,
        label: `${d.name} · ${SEGMENT_ABBREV[segment]}`,
      });
    }
  }
  return out;
}

/**
 * Parse `catalog_IS_COM_2026-07-08.xlsx` → { divisionCode, segment, date? }.
 * Returns null if the filename does not match.
 */
export function parseScopeFromFilename(filename: string): {
  scopeCode: string;
  divisionCode: string;
  segment: Segment;
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
    date: m[3],
  };
}

export function exportFileName(scopeCode: string, date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10);
  return `catalog_${scopeCode}_${ymd}.xlsx`;
}
