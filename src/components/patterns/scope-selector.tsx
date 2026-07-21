"use client";

import { useMemo } from "react";
import type { Segment } from "@prisma/client";
import {
  customerSegmentsForDivision,
  resolveStorageScope,
} from "@/features/materials/scope";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ScopeDivisionOption = {
  id: string;
  slug: string;
  name: string;
};

const SEGMENT_LABEL: Record<Segment, string> = {
  COMMERCIAL: "Commercial",
  RESIDENTIAL: "Residential",
  STR: "STR",
};

export function ScopeSelector({
  divisions,
  divisionId,
  segment,
  onChange,
  className,
}: {
  divisions: ScopeDivisionOption[];
  divisionId: string;
  segment: Segment;
  onChange: (next: { divisionId: string; segment: Segment }) => void;
  className?: string;
}) {
  const selected = useMemo(
    () => divisions.find((d) => d.id === divisionId) ?? divisions[0] ?? null,
    [divisions, divisionId],
  );

  const segmentOptions = useMemo(() => {
    if (!selected) return [] as Segment[];
    return customerSegmentsForDivision(selected.slug);
  }, [selected]);

  const resolved = useMemo(() => {
    if (!selected || !segmentOptions.includes(segment)) return null;
    try {
      return resolveStorageScope(selected.slug, segment);
    } catch {
      return null;
    }
  }, [selected, segment, segmentOptions]);

  function onDivisionChange(nextId: string | null) {
    if (!nextId) return;
    const d = divisions.find((x) => x.id === nextId);
    if (!d) return;
    const segs = customerSegmentsForDivision(d.slug);
    const nextSeg = segs.includes(segment)
      ? segment
      : (segs[0] ?? "COMMERCIAL");
    onChange({ divisionId: nextId, segment: nextSeg });
  }

  function onSegmentChange(nextSeg: string | null) {
    if (!nextSeg || !selected) return;
    onChange({
      divisionId: selected.id,
      segment: nextSeg as Segment,
    });
  }

  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">No divisions configured.</p>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="scope-division">Division</Label>
          <Select
            value={selected.id}
            onValueChange={(v) => onDivisionChange(v)}
          >
            <SelectTrigger
              id="scope-division"
              className="min-w-[12rem]"
              aria-label="Division"
            >
              <SelectValue>
                {(value: string | null) =>
                  divisions.find((d) => d.id === value)?.name ?? "Division"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scope-segment">Segment</Label>
          <Select value={segment} onValueChange={(v) => onSegmentChange(v)}>
            <SelectTrigger
              id="scope-segment"
              className="min-w-[10rem]"
              aria-label="Segment"
            >
              <SelectValue>
                {(value: string | null) =>
                  value && value in SEGMENT_LABEL
                    ? SEGMENT_LABEL[value as Segment]
                    : "Segment"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {segmentOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEGMENT_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Scope code</div>
          <div className="flex h-8 items-center font-mono text-sm">
            {resolved?.scopeCode ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
