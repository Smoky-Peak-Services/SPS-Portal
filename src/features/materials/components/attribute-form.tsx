"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAttribute,
  createOption,
  updateAttribute,
} from "@/features/materials/actions";
import type { MaterialAttributeInputType, Segment } from "@prisma/client";
import { AttributeOptionRow } from "./attribute-option-row";
import {
  ScopeSelector,
  type ScopeDivisionOption,
} from "@/components/patterns/scope-selector";

type Option = {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { itemValues: number; defaultFor: number };
};

type Props = {
  canForceDelete?: boolean;
  /** Required for create mode — scope the new attribute belongs to. */
  divisions?: ScopeDivisionOption[];
  defaultDivisionId?: string;
  defaultSegment?: Segment;
  initial?: {
    id: string;
    name: string;
    slug: string;
    inputType: MaterialAttributeInputType;
    unit: string | null;
    isActive: boolean;
    options: Option[];
    divisionName?: string;
    segment?: Segment;
  };
};

export function AttributeForm({
  initial,
  canForceDelete = false,
  divisions,
  defaultDivisionId,
  defaultSegment,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optPending, startOpt] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<{ divisionId: string; segment: Segment }>({
    divisionId: defaultDivisionId ?? divisions?.[0]?.id ?? "",
    segment: defaultSegment ?? "COMMERCIAL",
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        const base = {
          name: String(fd.get("name") || ""),
          slug: String(fd.get("slug") || "") || undefined,
          inputType: String(
            fd.get("inputType") || "TEXT",
          ) as MaterialAttributeInputType,
          unit: String(fd.get("unit") || ""),
          isActive: fd.get("isActive") === "on",
        };
        if (initial) {
          await updateAttribute({ id: initial.id, ...base });
          router.refresh();
        } else {
          if (!scope.divisionId) {
            throw new Error("Choose a scope for the new attribute");
          }
          const attr = await createAttribute({
            ...base,
            divisionId: scope.divisionId,
            segment: scope.segment,
          });
          router.push(`/materials/attributes/${attr.id}`);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onAddOption(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!initial) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    startOpt(async () => {
      try {
        await createOption({
          attributeId: initial.id,
          value: String(fd.get("value") || ""),
          label: String(fd.get("label") || ""),
          sortOrder: Number(fd.get("sortOrder") || 0),
        });
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Option failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-6"
      >
        {!initial && divisions ? (
          <ScopeSelector
            divisions={divisions}
            divisionId={scope.divisionId}
            segment={scope.segment}
            onChange={setScope}
          />
        ) : null}
        {initial?.divisionName ? (
          <p className="text-sm text-muted-foreground">
            Scope: {initial.divisionName} · {initial.segment}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={initial?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (optional, unique within the scope)</Label>
          <Input id="slug" name="slug" defaultValue={initial?.slug} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inputType">Input type</Label>
            <select
              id="inputType"
              name="inputType"
              defaultValue={initial?.inputType ?? "SELECT"}
              disabled={!!initial}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 text-sm disabled:opacity-60"
            >
              <option value="SELECT">Select</option>
              <option value="MULTISELECT">Multi-select</option>
              <option value="TEXT">Text</option>
              <option value="NUMBER">Number</option>
              <option value="BOOLEAN">Boolean</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit (for NUMBER)</Label>
            <Input id="unit" name="unit" defaultValue={initial?.unit ?? ""} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial?.isActive ?? true}
          />
          Active
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : initial
              ? "Update attribute"
              : "Create attribute"}
        </Button>
      </form>

      {initial &&
      (initial.inputType === "SELECT" ||
        initial.inputType === "MULTISELECT") ? (
        <div className="max-w-2xl space-y-3 rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Options
          </h2>
          <ul>
            {initial.options.map((o) => (
              <AttributeOptionRow
                key={o.id}
                option={o}
                canForceDelete={canForceDelete}
              />
            ))}
            {initial.options.length === 0 ? (
              <li className="py-2 text-sm text-muted-foreground">
                No options yet.
              </li>
            ) : null}
          </ul>
          <form onSubmit={onAddOption} className="grid gap-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="value">Value key</Label>
                <Input id="value" name="value" required placeholder="wiegand" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="label">Label</Label>
                <Input id="label" name="label" required placeholder="Wiegand" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={initial.options.length}
              />
            </div>
            <Button type="submit" size="sm" disabled={optPending}>
              {optPending ? "Adding…" : "Add option"}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
