/**
 * Scope resolution (prompt 14).
 *
 * Three independent scopes, nothing shared:
 * - Integrated Systems / COMMERCIAL (IS_COM)
 * - Integrated Systems / RESIDENTIAL (IS_RES)
 * - Cabin Services / STR (CS_STR) — Cabin is a single, undivided scope.
 */
import {
  company,
  getDivision,
  type Segment as CompanySegment,
} from "@/config/company";
import type { Segment as PrismaSegment } from "@prisma/client";

const SEGMENT_ABBREV: Record<PrismaSegment, string> = {
  COMMERCIAL: "COM",
  RESIDENTIAL: "RES",
  STR: "STR",
};

const SEGMENT_LABEL: Record<PrismaSegment, string> = {
  COMMERCIAL: "Commercial",
  RESIDENTIAL: "Residential",
  STR: "STR",
};

/** e.g. Integrated Systems + COMMERCIAL → IS_COM */
export function scopeCodeFor(
  divisionCode: string,
  segment: PrismaSegment,
): string {
  return `${divisionCode.toUpperCase()}_${SEGMENT_ABBREV[segment]}`;
}

export function segmentAbbrev(segment: PrismaSegment): string {
  return SEGMENT_ABBREV[segment];
}

export function toPrismaSegment(
  seg: string | CompanySegment | PrismaSegment,
): PrismaSegment | null {
  const s = String(seg).toLowerCase();
  if (s === "commercial") return "COMMERCIAL";
  if (s === "residential") return "RESIDENTIAL";
  if (s === "str") return "STR";
  if (seg === "COMMERCIAL" || seg === "RESIDENTIAL" || seg === "STR") {
    return seg;
  }
  return null;
}

export function fromPrismaSegment(seg: PrismaSegment): CompanySegment {
  switch (seg) {
    case "COMMERCIAL":
      return "commercial";
    case "RESIDENTIAL":
      return "residential";
    case "STR":
      return "str";
    default: {
      const _exhaustive: never = seg;
      return _exhaustive;
    }
  }
}

export type CustomerScope = {
  divisionSlug: string;
  divisionName: string;
  divisionCode: string;
  customerSegment: PrismaSegment;
  storageSegment: PrismaSegment;
  scopeCode: string;
  label: string;
};

export function listCustomerScopes(): CustomerScope[] {
  const out: CustomerScope[] = [];
  for (const d of company.divisions) {
    for (const seg of d.segments) {
      const segment = toPrismaSegment(seg);
      if (!segment) continue;
      out.push({
        divisionSlug: d.slug,
        divisionName: d.name,
        divisionCode: d.code,
        customerSegment: segment,
        storageSegment: segment,
        scopeCode: scopeCodeFor(d.code, segment),
        label:
          d.segments.length > 1
            ? `${d.name} · ${SEGMENT_LABEL[segment]}`
            : d.name,
      });
    }
  }
  return out;
}

export type ResolvedStorageScope = {
  divisionSlug: string;
  customerSegment: PrismaSegment;
  storageSegment: PrismaSegment;
  scopeCode: string;
};

/**
 * Validate a division + segment pair and return the scope used for Prisma
 * reads/writes. Storage always equals the requested segment (prompt 14 removed
 * the shared-catalog aliasing); invalid pairs throw.
 */
export function resolveStorageScope(
  divisionSlug: string,
  segment: PrismaSegment | string,
): ResolvedStorageScope {
  const division = getDivision(divisionSlug);
  if (!division) {
    throw new Error(`Unknown division slug: ${divisionSlug}`);
  }
  const seg = toPrismaSegment(segment);
  if (!seg) {
    throw new Error(`Invalid segment: ${segment}`);
  }
  const allowed = division.segments
    .map((s) => toPrismaSegment(s))
    .filter((s): s is PrismaSegment => s != null);
  if (!allowed.includes(seg)) {
    throw new Error(
      `Segment ${seg} is not valid for division ${division.slug}`,
    );
  }

  return {
    divisionSlug: division.slug,
    customerSegment: seg,
    storageSegment: seg,
    scopeCode: scopeCodeFor(division.code, seg),
  };
}

/** Segments for a division (Prisma enum), from company config. */
export function customerSegmentsForDivision(
  divisionSlug: string,
): PrismaSegment[] {
  const division = getDivision(divisionSlug);
  if (!division) return [];
  return division.segments
    .map((s) => toPrismaSegment(s))
    .filter((s): s is PrismaSegment => s != null);
}
