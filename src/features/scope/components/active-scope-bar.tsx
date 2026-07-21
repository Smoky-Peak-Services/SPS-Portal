"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Segment } from "@prisma/client";
import { ScopeSelector } from "@/components/patterns/scope-selector";
import {
  ACTIVE_SCOPE_COOKIE,
  encodeActiveScopeCookie,
  resolveActiveScope,
  type ScopeDivision,
} from "@/features/scope/active-scope";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The one scope switcher for Catalog + Rates, rendered by the section layouts
 * below the tabs. URL params override the server-resolved (cookie/default)
 * scope; changing it writes the cookie and navigates with
 * `?divisionId=&segment=` while preserving other query keys (e.g. taxReview).
 */
export function ActiveScopeBar({
  divisions,
  initialDivisionSlug,
  initialSegment,
}: {
  divisions: ScopeDivision[];
  initialDivisionSlug: string;
  initialSegment: Segment;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const current = useMemo(
    () =>
      resolveActiveScope({
        divisions,
        url: {
          divisionId: searchParams.get("divisionId") ?? undefined,
          segment: searchParams.get("segment") ?? undefined,
        },
        fallback: {
          divisionSlug: initialDivisionSlug,
          segment: initialSegment,
        },
      }),
    [divisions, searchParams, initialDivisionSlug, initialSegment],
  );

  if (!current) return null;

  function onChange(next: { divisionId: string; segment: Segment }) {
    const division = divisions.find((d) => d.id === next.divisionId);
    if (division) {
      const value = encodeURIComponent(
        encodeActiveScopeCookie(division.slug, next.segment),
      );
      document.cookie = `${ACTIVE_SCOPE_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("divisionId", next.divisionId);
    params.set("segment", next.segment);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <ScopeSelector
        divisions={divisions}
        divisionId={current.divisionId}
        segment={current.segment}
        onChange={onChange}
      />
    </div>
  );
}
