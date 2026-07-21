"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Segment } from "@prisma/client";
import {
  ScopeSelector,
  type ScopeDivisionOption,
} from "@/components/patterns/scope-selector";

/** URL-driven scope filter (?divisionId=&segment=) for pricing / recurring pages. */
export function ScopeFilterBar({
  divisions,
  divisionId,
  segment,
}: {
  divisions: ScopeDivisionOption[];
  divisionId: string;
  segment: Segment;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  return (
    <ScopeSelector
      divisions={divisions}
      divisionId={divisionId}
      segment={segment}
      onChange={({ divisionId: d, segment: s }) => {
        const params = new URLSearchParams({
          divisionId: d,
          segment: s,
        });
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
