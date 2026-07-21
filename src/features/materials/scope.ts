/**
 * Customer segment vs storage segment resolution (prompt 13).
 *
 * Cabin Services: customer STR | RESIDENTIAL both map to storage STR (shared).
 * Integrated Systems: storage === customer segment (independent datasets).
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
  shared: boolean;
  label: string;
};

export function listCustomerScopes(): CustomerScope[] {
  const out: CustomerScope[] = [];
  for (const d of company.divisions) {
    for (const seg of d.segments) {
      const customerSegment = toPrismaSegment(seg);
      if (!customerSegment) continue;
      const resolved = resolveStorageScope(d.slug, customerSegment);
      out.push({
        divisionSlug: d.slug,
        divisionName: d.name,
        divisionCode: d.code,
        customerSegment,
        storageSegment: resolved.storageSegment,
        scopeCode: resolved.scopeCode,
        shared: resolved.shared,
        label: `${d.name} · ${SEGMENT_LABEL[customerSegment]}`,
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
  shared: boolean;
};

/**
 * Map a picker (customer) segment to the Prisma storage segment for queries.
 * Invalid division/segment pairs throw.
 */
export function resolveStorageScope(
  divisionSlug: string,
  customerSegment: PrismaSegment | string,
): ResolvedStorageScope {
  const division = getDivision(divisionSlug);
  if (!division) {
    throw new Error(`Unknown division slug: ${divisionSlug}`);
  }
  const customer = toPrismaSegment(customerSegment);
  if (!customer) {
    throw new Error(`Invalid segment: ${customerSegment}`);
  }
  const allowed = division.segments
    .map((s) => toPrismaSegment(s))
    .filter((s): s is PrismaSegment => s != null);
  if (!allowed.includes(customer)) {
    throw new Error(
      `Segment ${customer} is not valid for division ${division.slug}`,
    );
  }

  if (division.sharedCatalog) {
    const storage = toPrismaSegment(division.storageSegment ?? "");
    if (!storage) {
      throw new Error(
        `Division "${division.slug}" has sharedCatalog but no storageSegment`,
      );
    }
    return {
      divisionSlug: division.slug,
      customerSegment: customer,
      storageSegment: storage,
      // Scope code uses the *customer* segment so CS_RES stays visible.
      scopeCode: scopeCodeFor(division.code, customer),
      shared: true,
    };
  }

  return {
    divisionSlug: division.slug,
    customerSegment: customer,
    storageSegment: customer,
    scopeCode: scopeCodeFor(division.code, customer),
    shared: false,
  };
}

/** Customer segments for a division (Prisma enum), from company config. */
export function customerSegmentsForDivision(
  divisionSlug: string,
): PrismaSegment[] {
  const division = getDivision(divisionSlug);
  if (!division) return [];
  return division.segments
    .map((s) => toPrismaSegment(s))
    .filter((s): s is PrismaSegment => s != null);
}
