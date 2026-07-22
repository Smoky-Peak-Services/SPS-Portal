"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BillingCycle,
  RateValueType,
  RecurringFeeType,
  RecurringFeeUnit,
  Segment,
} from "@prisma/client";
import {
  createRecurringFeeItem,
  deleteRecurringFeeItem,
  updateRecurringFeeItem,
} from "@/features/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const FEE_TYPES: { value: RecurringFeeType; label: string }[] = [
  { value: "SMA_BASE_TIER", label: "SMA base tier" },
  { value: "SMA_SVM", label: "SMA SVM %" },
  { value: "SMA_BANK_OF_HOURS", label: "SMA bank of hours" },
  { value: "MONTHLY_SERVICE", label: "Monthly service" },
];

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "ANNUAL", label: "Annual" },
  { value: "MONTHLY", label: "Monthly" },
];

const VALUE_TYPES: { value: RateValueType; label: string }[] = [
  { value: "CURRENCY", label: "Currency ($)" },
  { value: "PERCENT", label: "Percent (decimal)" },
];

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

function readFeeForm(fd: FormData) {
  return {
    sku: fd.get("sku"),
    description: fd.get("description"),
    baseCost: fd.get("baseCost"),
    directPurchaseRate: fd.get("directPurchaseRate"),
    smaBundledRate: fd.get("smaBundledRate"),
    billingCycle: fd.get("billingCycle"),
    feeType: fd.get("feeType"),
    valueType: fd.get("valueType"),
    notes: fd.get("notes"),
    isActive: fd.get("isActive") === "on",
    sortOrder: fd.get("sortOrder"),
    systemValueMin: fd.get("systemValueMin") ?? "",
    systemValueMax: fd.get("systemValueMax") ?? "",
  };
}

export function RecurringFeesTable({
  items,
  canWrite,
  divisionId,
  segment,
}: {
  items: Row[];
  canWrite: boolean;
  divisionId: string;
  segment: Segment;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Add and edit fees for this scope only. SMA annual price = base tier +
        SVM (on <strong className="text-foreground">material value only</strong>
        ) + Bank of Hours. Monthly services use a separate flat rate path (no
        SVM). <strong className="text-foreground">Bank of Hours</strong> sell
        rate is derived live from Tech 1&amp;2 × 0.90 — stored dollar columns
        are placeholders for that fee type.
      </p>

      {canWrite ? (
        <AddRecurringFeeForm divisionId={divisionId} segment={segment} />
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No recurring fees in this scope yet.
          {canWrite
            ? " Use Add fee above to build the sheet (e.g. Residential)."
            : ""}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecurringFeeEditCard
              key={item.id}
              row={item}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddRecurringFeeForm({
  divisionId,
  segment,
}: {
  divisionId: string;
  segment: Segment;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feeType, setFeeType] = useState<RecurringFeeType>("MONTHLY_SERVICE");
  const [valueType, setValueType] = useState<RateValueType>("CURRENCY");

  function onFeeTypeChange(next: RecurringFeeType) {
    setFeeType(next);
    if (next === "SMA_SVM") setValueType("PERCENT");
    else if (next === "SMA_BASE_TIER") setValueType("CURRENCY");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await createRecurringFeeItem({
          divisionId,
          segment,
          ...readFeeForm(fd),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Add fee
      </Button>
    );
  }

  const isTier = feeType === "SMA_BASE_TIER";
  const defaultBilling: BillingCycle =
    feeType === "MONTHLY_SERVICE" ? "MONTHLY" : "ANNUAL";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-primary/40 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">New recurring fee</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      <FeeFieldGrid
        pending={pending}
        feeType={feeType}
        valueType={valueType}
        defaultBillingCycle={defaultBilling}
        onFeeTypeChange={onFeeTypeChange}
        onValueTypeChange={setValueType}
        defaults={{
          sku: "",
          description: "",
          baseCost: "0",
          directPurchaseRate: "0",
          smaBundledRate: "0",
          notes: "—",
          sortOrder: String(0),
          isActive: true,
          systemValueMin: "",
          systemValueMax: "",
        }}
        showTierBounds={isTier}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create fee"}
        </Button>
        {error ? (
          <span className="text-sm text-destructive" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
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
  const [feeType, setFeeType] = useState<RecurringFeeType>(row.feeType);
  const [valueType, setValueType] = useState<RateValueType>(row.valueType);
  const isBoh = feeType === "SMA_BANK_OF_HOURS";
  const isTier = feeType === "SMA_BASE_TIER";

  function onFeeTypeChange(next: RecurringFeeType) {
    setFeeType(next);
    if (next === "SMA_SVM") setValueType("PERCENT");
    else if (next === "SMA_BASE_TIER") setValueType("CURRENCY");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateRecurringFeeItem({
          id: row.id,
          ...readFeeForm(fd),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onDelete() {
    if (!canWrite) return;
    if (
      !window.confirm(
        `Delete recurring fee "${row.sku}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await deleteRecurringFeeItem({ id: row.id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
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
      <FeeFieldGrid
        pending={pending}
        feeType={feeType}
        valueType={valueType}
        defaultBillingCycle={row.billingCycle}
        onFeeTypeChange={onFeeTypeChange}
        onValueTypeChange={setValueType}
        defaults={{
          sku: row.sku,
          description: row.description,
          baseCost: row.baseCost.toString(),
          directPurchaseRate: row.directPurchaseRate.toString(),
          smaBundledRate: row.smaBundledRate.toString(),
          notes: row.notes,
          sortOrder: String(row.sortOrder),
          isActive: row.isActive,
          systemValueMin: row.systemValueMin?.toString() ?? "",
          systemValueMax: row.systemValueMax?.toString() ?? "",
        }}
        showTierBounds={isTier}
        bohHint={isBoh}
        showStoredHint
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </Button>
        {error ? (
          <span className="text-sm text-destructive" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

type FeeDefaults = {
  sku: string;
  description: string;
  baseCost: string;
  directPurchaseRate: string;
  smaBundledRate: string;
  notes: string;
  sortOrder: string;
  isActive: boolean;
  systemValueMin: string;
  systemValueMax: string;
};

function FeeFieldGrid({
  pending,
  feeType,
  valueType,
  defaultBillingCycle,
  onFeeTypeChange,
  onValueTypeChange,
  defaults,
  showTierBounds,
  bohHint,
  showStoredHint,
}: {
  pending: boolean;
  feeType: RecurringFeeType;
  valueType: RateValueType;
  defaultBillingCycle: BillingCycle;
  onFeeTypeChange: (v: RecurringFeeType) => void;
  onValueTypeChange: (v: RateValueType) => void;
  defaults: FeeDefaults;
  showTierBounds: boolean;
  bohHint?: boolean;
  showStoredHint?: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`desc-${defaults.sku || "new"}`}>Description</Label>
          <Input
            id={`desc-${defaults.sku || "new"}`}
            name="description"
            defaultValue={defaults.description}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sku-${defaults.sku || "new"}`}>SKU</Label>
          <Input
            id={`sku-${defaults.sku || "new"}`}
            name="sku"
            defaultValue={defaults.sku}
            disabled={pending}
            required
            className="font-mono"
            placeholder="REC-…"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sort-${defaults.sku || "new"}`}>Sort</Label>
          <Input
            id={`sort-${defaults.sku || "new"}`}
            name="sortOrder"
            type="number"
            defaultValue={defaults.sortOrder}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`feeType-${defaults.sku || "new"}`}>Fee type</Label>
          <select
            id={`feeType-${defaults.sku || "new"}`}
            name="feeType"
            value={feeType}
            onChange={(e) =>
              onFeeTypeChange(e.target.value as RecurringFeeType)
            }
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {FEE_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`billing-${defaults.sku || "new"}`}>
            Billing cycle
          </Label>
          <select
            id={`billing-${defaults.sku || "new"}`}
            name="billingCycle"
            defaultValue={defaultBillingCycle}
            key={`${feeType}-${defaultBillingCycle}`}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {BILLING_CYCLES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            SMA types require Annual; monthly services require Monthly.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`valueType-${defaults.sku || "new"}`}>
            Value type
          </Label>
          <select
            id={`valueType-${defaults.sku || "new"}`}
            name="valueType"
            value={valueType}
            onChange={(e) => onValueTypeChange(e.target.value as RateValueType)}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {VALUE_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={defaults.isActive}
              disabled={pending}
              className="size-4 rounded border"
            />
            Active
          </label>
          {bohHint ? (
            <span className="ml-3 text-xs text-amber-700">
              BOH sell rate derived live
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["baseCost", "Base", defaults.baseCost],
            ["directPurchaseRate", "Direct", defaults.directPurchaseRate],
            ["smaBundledRate", "SMA bundled", defaults.smaBundledRate],
          ] as const
        ).map(([name, label, value]) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={`${name}-${defaults.sku || "new"}`}>
              {label} ({rateInputLabel(valueType)})
            </Label>
            <Input
              id={`${name}-${defaults.sku || "new"}`}
              name={name}
              type="number"
              step="any"
              defaultValue={value}
              disabled={pending}
              required
            />
            {showStoredHint ? (
              <p className="text-[10px] text-muted-foreground">
                Stored: {formatRate(valueType, value)}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {showTierBounds ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`min-${defaults.sku || "new"}`}>
              System value min
            </Label>
            <Input
              id={`min-${defaults.sku || "new"}`}
              name="systemValueMin"
              type="number"
              step="any"
              defaultValue={defaults.systemValueMin}
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`max-${defaults.sku || "new"}`}>
              System value max (blank = open)
            </Label>
            <Input
              id={`max-${defaults.sku || "new"}`}
              name="systemValueMax"
              type="number"
              step="any"
              defaultValue={defaults.systemValueMax}
              disabled={pending}
            />
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="systemValueMin" value="" />
          <input type="hidden" name="systemValueMax" value="" />
        </>
      )}

      <div className="space-y-1">
        <Label htmlFor={`notes-${defaults.sku || "new"}`}>Notes</Label>
        <textarea
          id={`notes-${defaults.sku || "new"}`}
          name="notes"
          defaultValue={defaults.notes}
          disabled={pending}
          required
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </>
  );
}
