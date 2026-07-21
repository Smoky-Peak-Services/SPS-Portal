/**
 * Shared helpers for pricing / recurring pages that use ?divisionId=&segment=.
 */
import type { Segment } from "@prisma/client";
import { customerSegmentsForDivision } from "@/features/materials/scope";

export type ScopeDivision = {
  id: string;
  name: string;
  slug: string;
};

export function parseCustomerSegment(
  raw: string | undefined,
): Segment | null {
  const u = (raw ?? "").toUpperCase();
  if (u === "COMMERCIAL" || u === "RESIDENTIAL" || u === "STR") return u;
  return null;
}

/**
 * Pick division + customer segment from URL params against company config.
 * Falls back to Integrated Systems / first operational division + first valid segment.
 */
export function resolvePageScope(params: {
  divisionId?: string;
  segment?: string;
  divisions: ScopeDivision[];
  preferredSlug?: string;
}): { divisionId: string; segment: Segment } {
  const preferred =
    params.divisions.find((d) => d.slug === (params.preferredSlug ?? "integrated-systems")) ??
    params.divisions[0];

  const division =
    (params.divisionId
      ? params.divisions.find((d) => d.id === params.divisionId)
      : null) ?? preferred;

  if (!division) {
    return { divisionId: "", segment: "COMMERCIAL" };
  }

  const allowed = customerSegmentsForDivision(division.slug);
  const fromUrl = parseCustomerSegment(params.segment);
  const segment =
    fromUrl && allowed.includes(fromUrl)
      ? fromUrl
      : (allowed[0] ?? "COMMERCIAL");

  return { divisionId: division.id, segment };
}
