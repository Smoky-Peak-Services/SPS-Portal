"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDomain, updateDomain } from "@/features/materials/actions";
import type { Segment } from "@prisma/client";

type Division = {
  id: string;
  name: string;
  segments: string[];
};

type DomainFormProps = {
  divisions: Division[];
  /** Active-scope defaults for create mode (prompt 15). */
  defaultDivisionId?: string;
  defaultSegment?: Segment;
  initial?: {
    id: string;
    divisionId: string;
    segment: Segment;
    name: string;
    slug: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  };
};

const SEGMENT_OPTIONS: { value: Segment; label: string; company: string }[] = [
  { value: "COMMERCIAL", label: "Commercial", company: "commercial" },
  { value: "RESIDENTIAL", label: "Residential", company: "residential" },
  { value: "STR", label: "STR", company: "str" },
];

export function DomainForm({
  divisions,
  defaultDivisionId,
  defaultSegment,
  initial,
}: DomainFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState(
    initial?.divisionId ?? defaultDivisionId ?? divisions[0]?.id ?? "",
  );

  const division = divisions.find((d) => d.id === divisionId);
  const allowedSegments = SEGMENT_OPTIONS.filter((s) =>
    (division?.segments ?? []).includes(s.company),
  );
  const defaultSegmentValue =
    initial?.segment ??
    (defaultSegment && allowedSegments.some((s) => s.value === defaultSegment)
      ? defaultSegment
      : allowedSegments[0]?.value);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        if (initial) {
          await updateDomain({
            id: initial.id,
            divisionId: String(fd.get("divisionId") || ""),
            segment: String(fd.get("segment") || "COMMERCIAL") as Segment,
            name: String(fd.get("name") || ""),
            slug: String(fd.get("slug") || "") || undefined,
            description: String(fd.get("description") || ""),
            sortOrder: Number(fd.get("sortOrder") || 0),
            isActive: fd.get("isActive") === "on",
          });
        } else {
          await createDomain({
            divisionId: String(fd.get("divisionId") || ""),
            segment: String(fd.get("segment") || "COMMERCIAL") as Segment,
            name: String(fd.get("name") || ""),
            slug: String(fd.get("slug") || "") || undefined,
            description: String(fd.get("description") || ""),
            sortOrder: Number(fd.get("sortOrder") || 0),
            isActive: fd.get("isActive") === "on",
          });
        }
        router.push("/materials/domains");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="divisionId">Division</Label>
        <select
          id="divisionId"
          name="divisionId"
          required
          value={divisionId}
          onChange={(e) => setDivisionId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
        >
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="segment">Segment</Label>
        <select
          id="segment"
          name="segment"
          required
          defaultValue={defaultSegmentValue}
          className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
        >
          {allowedSegments.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug (optional)</Label>
        <Input id="slug" name="slug" defaultValue={initial?.slug} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={initial?.sortOrder ?? 0}
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial?.isActive ?? true}
          />
          Active
        </label>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : initial ? "Update domain" : "Create domain"}
      </Button>
    </form>
  );
}
