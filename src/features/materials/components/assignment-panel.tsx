"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  deleteAssignment,
  upsertAssignment,
} from "@/features/materials/actions";

type AttributeOption = {
  id: string;
  name: string;
  slug: string;
  inputType: string;
};

type Assignment = {
  id: string;
  attributeId: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantDefining: boolean;
  sortOrder: number;
  attribute: { name: string; slug: string; inputType: string };
};

type Props = {
  categoryId: string;
  assignments: Assignment[];
  availableAttributes: AttributeOption[];
};

export function AssignmentPanel({
  categoryId,
  assignments,
  availableAttributes,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(assignments.map((a) => a.attributeId));
  const unassigned = availableAttributes.filter((a) => !assignedIds.has(a.id));

  function onAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await upsertAssignment({
          categoryId,
          attributeId: String(fd.get("attributeId") || ""),
          isRequired: fd.get("isRequired") === "on",
          isFilterable: fd.get("isFilterable") === "on",
          isVariantDefining: fd.get("isVariantDefining") === "on",
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Assign failed");
      }
    });
  }

  function onRemove(id: string) {
    setError(null);
    start(async () => {
      try {
        await deleteAssignment({ id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Remove failed");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Attribute assignments
      </h2>
      <ul className="divide-y text-sm">
        {assignments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div>
              <div className="font-medium">{a.attribute.name}</div>
              <div className="text-xs text-slate-500">
                {a.attribute.slug} · {a.attribute.inputType}
                {a.isRequired ? " · required" : ""}
                {a.isFilterable ? " · filterable" : ""}
                {a.isVariantDefining ? " · variant" : ""}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onRemove(a.id)}
            >
              Remove
            </Button>
          </li>
        ))}
        {assignments.length === 0 ? (
          <li className="py-2 text-slate-500">No attributes assigned.</li>
        ) : null}
      </ul>

      {unassigned.length > 0 ? (
        <form onSubmit={onAssign} className="space-y-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="attributeId">Assign attribute</Label>
            <select
              id="attributeId"
              name="attributeId"
              required
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {unassigned.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.inputType})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isRequired" />
              Required
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isFilterable" defaultChecked />
              Filterable
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="isVariantDefining" />
              Variant-defining
            </label>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Assign"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          All attributes are already assigned (or none exist yet).
        </p>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
