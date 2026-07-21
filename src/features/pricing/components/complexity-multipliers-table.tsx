"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ComplexityAppliedTo,
  ComplexityMultiplierType,
} from "@prisma/client";
import { updateComplexityMultiplier } from "@/features/pricing/actions";
import { AFTER_HOURS_COMPLEXITY_SLUG } from "@/features/pricing/is-com-complexity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  name: string;
  slug: string;
  category: string;
  multiplierType: ComplexityMultiplierType;
  appliedTo: ComplexityAppliedTo;
  value: { toString(): string };
  description: string;
  isActive: boolean;
  sortOrder: number;
};

const APPLIED_TO_OPTIONS: { value: ComplexityAppliedTo; label: string }[] = [
  { value: "TOTAL_LABOR", label: "Total labor hours" },
  { value: "PROGRAMMING_LABOR", label: "Programming labor hours" },
  { value: "NETWORK_LABOR", label: "Network labor hours" },
  { value: "BASE_PACKAGE_RATE", label: "Base package rate" },
];

function appliedToLabel(appliedTo: ComplexityAppliedTo): string {
  return (
    APPLIED_TO_OPTIONS.find((o) => o.value === appliedTo)?.label ?? appliedTo
  );
}

function formatValue(row: Row): string {
  const n = Number(row.value.toString());
  if (row.multiplierType === "FIXED") {
    return `$${n.toFixed(2)}`;
  }
  return `${(n * 100).toFixed((n * 100) % 1 === 0 ? 0 : 2)}%`;
}

export function ComplexityMultipliersTable({
  multipliers,
  canWrite,
}: {
  multipliers: Row[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Additive, not compounded. Percent rows applied to a labor bucket adjust{" "}
        <strong className="text-foreground">hours</strong> only (never labor
        dollars). Rows applied to the{" "}
        <strong className="text-foreground">base package rate</strong> add
        dollars per billing cycle (fixed amount, or percent of the base rate).{" "}
        <strong className="text-foreground">
          After Hours Required Installation
        </strong>{" "}
        (+20% hours) may stack with the after-hours <em>rate type</em> (higher
        $/hr) by design — choose both deliberately.
      </p>
      <div className="space-y-3">
        {multipliers.map((m) => (
          <ComplexityEditCard key={m.id} row={m} canWrite={canWrite} />
        ))}
      </div>
    </div>
  );
}

function ComplexityEditCard({
  row,
  canWrite,
}: {
  row: Row;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isAfterHours = row.slug === AFTER_HOURS_COMPLEXITY_SLUG;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateComplexityMultiplier({
          id: row.id,
          name: fd.get("name"),
          category: fd.get("category"),
          multiplierType: fd.get("multiplierType"),
          appliedTo: fd.get("appliedTo"),
          value: fd.get("value"),
          description: fd.get("description"),
          isActive: fd.get("isActive") === "on",
          sortOrder: fd.get("sortOrder"),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  if (!canWrite) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {row.slug} · {row.category} · {formatValue(row)} on{" "}
              {appliedToLabel(row.appliedTo)}
              {!row.isActive ? " · inactive" : ""}
            </div>
          </div>
          {isAfterHours ? (
            <span className="text-xs text-amber-700">
              Stacks with AFTER_HOURS rate type
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{row.description}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="name"
          defaultValue={row.name}
          disabled={pending}
          required
          className="min-w-[12rem] flex-1"
        />
        <Input
          name="category"
          defaultValue={row.category}
          disabled={pending}
          required
          className="w-40"
          title="Free-text category (e.g. Structural, Amenity)"
        />
        <select
          name="multiplierType"
          defaultValue={row.multiplierType}
          disabled={pending}
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="PERCENT">Percent</option>
          <option value="FIXED">Fixed $</option>
        </select>
        <select
          name="appliedTo"
          defaultValue={row.appliedTo}
          disabled={pending}
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {APPLIED_TO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input
          name="value"
          type="number"
          step="0.0001"
          min="0"
          defaultValue={row.value.toString()}
          disabled={pending}
          required
          className="w-28"
          title="Percent rows: decimal rate (0.08 = 8%). Fixed rows: dollars."
        />
        <Input
          name="sortOrder"
          type="number"
          step="1"
          defaultValue={row.sortOrder}
          disabled={pending}
          required
          className="w-20"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={row.isActive}
            disabled={pending}
          />
          Active
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {row.slug} · currently {formatValue(row)} on{" "}
        {appliedToLabel(row.appliedTo)}
        {isAfterHours ? " · stacks with AFTER_HOURS rate type" : ""}
      </div>
      <textarea
        name="description"
        defaultValue={row.description}
        disabled={pending}
        required
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
      />
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
