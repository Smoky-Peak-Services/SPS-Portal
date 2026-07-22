/**
 * Active-scope context (prompt 15).
 *
 * Catalog and Rates share one persistent "which of the three catalogs am I
 * looking at" selection. Resolution order: URL `?divisionId=&segment=` (when
 * valid) → `sps_active_scope` cookie → Integrated Systems / COMMERCIAL.
 *
 * Pure logic only — server plumbing lives in `get-active-scope.ts`, the UI in
 * `components/active-scope-bar.tsx`.
 */
import type { Segment } from "@prisma/client";
import {
  customerSegmentsForDivision,
  resolveScope,
} from "@/features/materials/scope";

export const ACTIVE_SCOPE_COOKIE = "sps_active_scope";
export const DEFAULT_SCOPE_DIVISION_SLUG = "integrated-systems";
export const DEFAULT_SCOPE_SEGMENT: Segment = "COMMERCIAL";

export type ScopeDivision = {
  id: string;
  name: string;
  slug: string;
};

export type ActiveScope = {
  divisionId: string;
  divisionSlug: string;
  divisionName: string;
  segment: Segment;
  scopeCode: string;
};

export function parseCustomerSegment(raw: string | undefined): Segment | null {
  const u = (raw ?? "").toUpperCase();
  if (u === "COMMERCIAL" || u === "RESIDENTIAL" || u === "STR") return u;
  return null;
}

/** Cookie value: `division-slug:SEGMENT` (matches `sps_surface` naming). */
export function encodeActiveScopeCookie(
  divisionSlug: string,
  segment: Segment,
): string {
  return `${divisionSlug}:${segment}`;
}

export function decodeActiveScopeCookie(
  value: string | null | undefined,
): { divisionSlug: string; segment: Segment } | null {
  if (!value) return null;
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  const divisionSlug = value.slice(0, idx).trim();
  const segment = parseCustomerSegment(value.slice(idx + 1));
  if (!divisionSlug || !segment) return null;
  return { divisionSlug, segment };
}

function toActiveScope(division: ScopeDivision, segment: Segment): ActiveScope {
  return {
    divisionId: division.id,
    divisionSlug: division.slug,
    divisionName: division.name,
    segment,
    scopeCode: resolveScope(division.slug, segment).scopeCode,
  };
}

function firstValidSegment(divisionSlug: string): Segment | null {
  return customerSegmentsForDivision(divisionSlug)[0] ?? null;
}

/**
 * Resolve the active scope. URL wins when its divisionId matches a known
 * division (an invalid/missing URL segment falls back to the division's first
 * segment); then the cookie (both parts must validate); then `fallback` (used
 * by the client bar to carry the server-resolved scope); then the default
 * Integrated Systems / COMMERCIAL. Returns null only when `divisions` is
 * empty.
 */
export function resolveActiveScope(params: {
  divisions: ScopeDivision[];
  url?: { divisionId?: string; segment?: string };
  cookie?: string | null;
  fallback?: { divisionSlug: string; segment: Segment };
}): ActiveScope | null {
  const { divisions, url, cookie, fallback } = params;
  if (divisions.length === 0) return null;

  if (url?.divisionId) {
    const division = divisions.find((d) => d.id === url.divisionId);
    if (division) {
      const allowed = customerSegmentsForDivision(division.slug);
      const fromUrl = parseCustomerSegment(url.segment);
      const segment =
        fromUrl && allowed.includes(fromUrl) ? fromUrl : (allowed[0] ?? null);
      if (segment) return toActiveScope(division, segment);
    }
  }

  const decoded = decodeActiveScopeCookie(cookie);
  if (decoded) {
    const division = divisions.find((d) => d.slug === decoded.divisionSlug);
    if (
      division &&
      customerSegmentsForDivision(division.slug).includes(decoded.segment)
    ) {
      return toActiveScope(division, decoded.segment);
    }
  }

  if (fallback) {
    const division = divisions.find((d) => d.slug === fallback.divisionSlug);
    if (
      division &&
      customerSegmentsForDivision(division.slug).includes(fallback.segment)
    ) {
      return toActiveScope(division, fallback.segment);
    }
  }

  const preferred =
    divisions.find((d) => d.slug === DEFAULT_SCOPE_DIVISION_SLUG) ??
    divisions[0];
  const allowed = customerSegmentsForDivision(preferred.slug);
  const segment = allowed.includes(DEFAULT_SCOPE_SEGMENT)
    ? DEFAULT_SCOPE_SEGMENT
    : firstValidSegment(preferred.slug);
  if (!segment) return null;
  return toActiveScope(preferred, segment);
}
