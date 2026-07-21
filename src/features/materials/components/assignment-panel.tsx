"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteAssignment,
  upsertAssignment,
} from "@/features/materials/actions";
import { isCoreCategoryAttributeSlug } from "@/features/materials/attribute-list-defs";
import { cn } from "@/lib/utils";

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
  const [busyId, setBusyId] = useState<string | null>(null);

  const byAttributeId = new Map(
    assignments.map((a) => [a.attributeId, a] as const),
  );
  const assignedCount = assignments.length;
  const totalCount = availableAttributes.length;

  function run(attributeId: string, fn: () => Promise<void>) {
    setError(null);
    setBusyId(attributeId);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      } finally {
        setBusyId(null);
      }
    });
  }

  function toggleAssign(attr: AttributeOption) {
    if (isCoreCategoryAttributeSlug(attr.slug)) {
      return;
    }
    const existing = byAttributeId.get(attr.id);
    if (existing) {
      run(attr.id, async () => {
        await deleteAssignment({ id: existing.id });
      });
      return;
    }
    run(attr.id, async () => {
      await upsertAssignment({
        categoryId,
        attributeId: attr.id,
        isRequired: false,
        isFilterable: true,
        isVariantDefining: false,
      });
    });
  }

  function setFlag(
    assignment: Assignment,
    patch: Partial<{
      isRequired: boolean;
      isFilterable: boolean;
      isVariantDefining: boolean;
    }>,
  ) {
    run(assignment.attributeId, async () => {
      await upsertAssignment({
        categoryId,
        attributeId: assignment.attributeId,
        isRequired: patch.isRequired ?? assignment.isRequired,
        isFilterable: patch.isFilterable ?? assignment.isFilterable,
        isVariantDefining:
          patch.isVariantDefining ?? assignment.isVariantDefining,
        sortOrder: assignment.sortOrder,
      });
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Attribute assignments
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-primary">{assignedCount}</span>
          {" of "}
          <span className="font-medium">{totalCount}</span>
          {" attributes assigned"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Tap a bubble to assign or remove. Manufacturer and Part Number are
        always assigned. Part Number required-ness follows the category checkbox
        above.
      </p>

      {availableAttributes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active attributes yet. Create some under Materials → Attributes.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableAttributes.map((attr) => {
            const assignment = byAttributeId.get(attr.id);
            const locked = isCoreCategoryAttributeSlug(attr.slug);
            const selected = locked || !!assignment;
            const thisBusy = pending && busyId === attr.id;
            return (
              <li
                key={attr.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-card hover:border-border",
                )}
              >
                <button
                  type="button"
                  disabled={pending || locked}
                  onClick={() => toggleAssign(attr)}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 rounded-lg text-left",
                    locked ? "cursor-default" : "",
                    pending && !thisBusy ? "opacity-60" : "",
                  )}
                  aria-pressed={selected}
                  title={
                    locked ? "Always assigned on every category" : undefined
                  }
                >
                  <span>
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        selected ? "text-foreground" : "text-foreground",
                      )}
                    >
                      {attr.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {attr.inputType}
                      {locked ? " · always assigned" : ""}
                      {thisBusy ? " · saving…" : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                      selected
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-card text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {selected ? "✓" : ""}
                  </span>
                </button>

                {assignment || locked ? (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-primary/20 pt-2">
                    {locked ? (
                      <>
                        {attr.slug === "part_number" ? (
                          <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border">
                            Required controlled by category checkbox above
                          </span>
                        ) : (
                          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-white">
                            Required
                          </span>
                        )}
                        {assignment ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              setFlag(assignment, {
                                isFilterable: !assignment.isFilterable,
                              })
                            }
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                              assignment.isFilterable
                                ? "bg-primary text-white"
                                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
                            )}
                            aria-pressed={assignment.isFilterable}
                          >
                            Filterable
                          </button>
                        ) : null}
                      </>
                    ) : assignment ? (
                      (
                        [
                          ["isRequired", "Required", assignment.isRequired],
                          [
                            "isFilterable",
                            "Filterable",
                            assignment.isFilterable,
                          ],
                          [
                            "isVariantDefining",
                            "Variant",
                            assignment.isVariantDefining,
                          ],
                        ] as const
                      ).map(([key, label, on]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setFlag(assignment, {
                              [key]: !on,
                            })
                          }
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                            on
                              ? "bg-primary text-white"
                              : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
                          )}
                          aria-pressed={on}
                        >
                          {label}
                        </button>
                      ))
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
