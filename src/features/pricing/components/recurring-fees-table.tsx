"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BillingCycle,
  RateValueType,
  RecurringFeeType,
  RecurringFeeUnit,
} from "@prisma/client";
import { updateRecurringFeeItem } from "@/features/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  sku: string;
  description: string;
  unit: RecurringFeeUnit;
  baseCost: { toString(): string };
  directPurchaseRate: { toString(): string };
  smaBundledRate: { toString(): string };
  billingCycle: BillingCycle;
  feeType: RecurringFeeType;
  valueType: RateValueType;
  systemValueMin: { toString(): string } | null;
  systemValueMax: { toString(): string } | null;
  notes: string;
  isActive: boolean;
  sortOrder: number;
};

function formatRate(valueType: RateValueType, raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (valueType === "PERCENT") {
    const pct = n * 100;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
  }
  return `$${n.toFixed(2)}`;
}

function rateInputLabel(valueType: RateValueType): string {
  return valueType === "PERCENT" ? "as decimal (e.g. 0.156)" : "USD";
}

export function RecurringFeesTable({
  items,
  canWrite,
}: {
  items: Row[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        SMA annual price = base tier + SVM (on{" "}
        <strong className="text-foreground">material value only</strong>) + Bank
        of Hours. Monthly services use a separate flat rate path (no SVM).{" "}
        <strong className="text-foreground">Bank of Hours</strong> sell rate is
        derived live from Tech 1&amp;2 × 0.90 — stored dollar columns are
        placeholders.
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <RecurringFeeEditCard key={item.id} row={item} canWrite={canWrite} />
        ))}
      </div>
    </div>
  );
}

function RecurringFeeEditCard({
  row,
  canWrite,
}: {
  row: Row;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isBoh = row.feeType === "SMA_BANK_OF_HOURS";
  const isTier = row.feeType === "SMA_BASE_TIER";
  const isPercent = row.valueType === "PERCENT";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateRecurringFeeItem({
          id: row.id,
          description: fd.get("description"),
          baseCost: fd.get("baseCost"),
          directPurchaseRate: fd.get("directPurchaseRate"),
          smaBundledRate: fd.get("smaBundledRate"),
          notes: fd.get("notes"),
          isActive: fd.get("isActive") === "on",
          sortOrder: fd.get("sortOrder"),
          ...(isTier
            ? {
                systemValueMin: fd.get("systemValueMin") ?? "",
                systemValueMax: fd.get("systemValueMax") ?? "",
              }
            : {}),
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
            <div className="font-medium">{row.description}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {row.sku} · {row.feeType} · {row.billingCycle} · {row.valueType}
              {!row.isActive ? " · inactive" : ""}
            </div>
          </div>
          {isBoh ? (
            <span className="text-xs text-amber-700">
              Derived from Tech 1&amp;2 × 0.90
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Base {formatRate(row.valueType, row.baseCost.toString())}</span>
          <span>
            Direct{" "}
            {formatRate(row.valueType, row.directPurchaseRate.toString())}
          </span>
          <span>
            Bundled {formatRate(row.valueType, row.smaBundledRate.toString())}
          </span>
          {isTier ? (
            <span>
              Value {row.systemValueMin?.toString() ?? "—"}–
              {row.systemValueMax?.toString() ?? "∞"}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{row.notes}</p>
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
          name="description"
          defaultValue={row.description}
          disabled={pending}
          required
          className="min-w-[12rem] flex-1"
        />
        <span className="font-mono text-xs text-muted-foreground">
          {row.sku}
        </span>
        <span className="rounded border border-border px-2 py-0.5 text-xs">
          {row.feeType}
        </span>
        {isBoh ? (
          <span className="text-xs text-amber-700">
            BOH derived from Tech 1&amp;2
          </span>
        ) : null}
        {isPercent ? (
          <span className="text-xs text-muted-foreground">PERCENT</span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Base ({rateInputLabel(row.valueType)})
          </label>
          <Input
            name="baseCost"
            type="number"
            step="any"
            defaultValue={row.baseCost.toString()}
            disabled={pending || isBoh}
            required
          />
          <p className="text-[10px] text-muted-foreground">
            Stored: {formatRate(row.valueType, row.baseCost.toString())}
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Direct ({rateInputLabel(row.valueType)})
          </label>
          <Input
            name="directPurchaseRate"
            type="number"
            step="any"
            defaultValue={row.directPurchaseRate.toString()}
            disabled={pending || isBoh}
            required
          />
          <p className="text-[10px] text-muted-foreground">
            Stored:{" "}
            {formatRate(row.valueType, row.directPurchaseRate.toString())}
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            SMA bundled ({rateInputLabel(row.valueType)})
          </label>
          <Input
            name="smaBundledRate"
            type="number"
            step="any"
            defaultValue={row.smaBundledRate.toString()}
            disabled={pending || isBoh}
            required
          />
          <p className="text-[10px] text-muted-foreground">
            Stored: {formatRate(row.valueType, row.smaBundledRate.toString())}
          </p>
        </div>
      </div>

      {isTier ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              System value min
            </label>
            <Input
              name="systemValueMin"
              type="number"
              step="any"
              defaultValue={row.systemValueMin?.toString() ?? ""}
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              System value max (blank = open)
            </label>
            <Input
              name="systemValueMax"
              type="number"
              step="any"
              defaultValue={row.systemValueMax?.toString() ?? ""}
              disabled={pending}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Notes</label>
        <textarea
          name="notes"
          defaultValue={row.notes}
          disabled={pending}
          required
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={row.isActive}
            disabled={pending}
            className="size-4 rounded border"
          />
          Active
        </label>
        <div className="flex items-center gap-2">
          <label
            className="text-xs text-muted-foreground"
            htmlFor={`sort-${row.id}`}
          >
            Sort
          </label>
          <Input
            id={`sort-${row.id}`}
            name="sortOrder"
            type="number"
            defaultValue={row.sortOrder}
            disabled={pending}
            className="w-20"
          />
        </div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save"}
        </Button>
        {error ? (
          <span className="text-sm text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  );
}
