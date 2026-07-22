"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createConsumable,
  deleteConsumable,
  updateConsumable,
} from "@/features/consumables/actions";
import {
  CONSUMABLE_PRICE_ANOMALY_SKUS,
  sellPriceFrom,
} from "@/features/consumables/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = {
  id: string;
  description: string;
  sku: string;
  category: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  unit: string;
  wasteFactorPct: { toString(): string };
  baseCost: { toString(): string } | null;
  isMarketRate: boolean;
  markupPct: { toString(): string };
  laborUnits: { toString(): string };
  supplier: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
};

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function pctLabel(decimal: number): string {
  const pct = decimal * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

function readForm(fd: FormData) {
  const isMarketRate = fd.get("isMarketRate") === "on";
  const baseRaw = String(fd.get("baseCost") ?? "").trim();
  return {
    description: fd.get("description"),
    sku: fd.get("sku"),
    category: fd.get("category"),
    manufacturer: fd.get("manufacturer"),
    partNumber: fd.get("partNumber"),
    unit: fd.get("unit"),
    wasteFactorPct: fd.get("wasteFactorPct"),
    baseCost: isMarketRate || baseRaw === "" ? null : baseRaw,
    isMarketRate,
    markupPct: fd.get("markupPct"),
    laborUnits: fd.get("laborUnits"),
    supplier: fd.get("supplier"),
    notes: fd.get("notes"),
    isActive: fd.get("isActive") === "on",
    sortOrder: fd.get("sortOrder"),
  };
}

export function ConsumablesTable({
  items,
  divisionId,
  divisionName,
  defaultMarkupPct,
  blendedLaborRate,
  canWrite,
  canDelete,
}: {
  items: Row[];
  divisionId: string;
  divisionName: string;
  defaultMarkupPct: number;
  blendedLaborRate: number | null;
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        One consumables list for all of{" "}
        <strong className="text-foreground">{divisionName}</strong> (shared
        across its segments). Sell price = base × (1 + markup). Labor rate and
        labor cost are{" "}
        <strong className="text-foreground">
          derived from the active scope&apos;s blended INSTALL rate
        </strong>
        {blendedLaborRate != null
          ? ` (currently ${money(blendedLaborRate)}/hr)`
          : " (seed labor rates for this scope to see the rate)"}
        — not stored on the item.
      </p>

      {canWrite ? (
        <AddConsumableForm
          divisionId={divisionId}
          defaultMarkupPct={defaultMarkupPct}
        />
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No consumables for {divisionName} yet.
          {canWrite ? " Use Add consumable above, or run the seed." : ""}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ConsumableEditCard
              key={item.id}
              row={item}
              blendedLaborRate={blendedLaborRate}
              canWrite={canWrite}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddConsumableForm({
  divisionId,
  defaultMarkupPct,
}: {
  divisionId: string;
  defaultMarkupPct: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isMarketRate, setIsMarketRate] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await createConsumable({ divisionId, ...readForm(fd) });
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
        Add consumable
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-primary/40 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">New consumable</h3>
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
      <ConsumableFields
        pending={pending}
        isMarketRate={isMarketRate}
        onMarketRateChange={setIsMarketRate}
        defaults={{
          description: "",
          sku: "",
          category: "",
          manufacturer: "",
          partNumber: "",
          unit: "Each",
          wasteFactorPct: "0",
          baseCost: "",
          markupPct: String(defaultMarkupPct),
          laborUnits: "0",
          supplier: "",
          notes: "",
          sortOrder: "0",
          isActive: true,
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating…" : "Create"}
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

function ConsumableEditCard({
  row,
  blendedLaborRate,
  canWrite,
  canDelete,
}: {
  row: Row;
  blendedLaborRate: number | null;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isMarketRate, setIsMarketRate] = useState(row.isMarketRate);
  const anomaly = CONSUMABLE_PRICE_ANOMALY_SKUS.has(row.sku);

  const base = row.baseCost == null ? null : Number(row.baseCost);
  const markup = Number(row.markupPct);
  const laborUnits = Number(row.laborUnits);
  const sell = sellPriceFrom(base, markup, row.isMarketRate);
  const laborCost =
    blendedLaborRate == null ? null : laborUnits * blendedLaborRate;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateConsumable({ id: row.id, ...readForm(fd) });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function onDelete() {
    if (!canDelete) return;
    if (
      !window.confirm(`Delete consumable "${row.sku}"? This cannot be undone.`)
    ) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await deleteConsumable({ id: row.id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  if (!canWrite) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <div className="font-medium">{row.description}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {row.sku}
          {row.category ? ` · ${row.category}` : ""}
          {row.manufacturer ? ` · ${row.manufacturer}` : ""}
          {!row.isActive ? " · inactive" : ""}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Unit {row.unit}</span>
          <span>Waste {pctLabel(Number(row.wasteFactorPct))}</span>
          <span>Base {row.isMarketRate ? "Market rate" : money(base)}</span>
          <span>Markup {pctLabel(markup)}</span>
          <span>Sell {row.isMarketRate ? "Market rate" : money(sell)}</span>
          <span>Labor units {laborUnits}</span>
          <span>
            Labor {money(blendedLaborRate)}/hr → cost {money(laborCost)}
          </span>
        </div>
        {anomaly ? (
          <p className="mt-2 text-xs text-amber-700">
            Review: sheet sale price looks wrong vs cost × markup (imported
            as-is).
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      {anomaly ? (
        <p className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Review this row: Cabin sheet sale was $0.80 against $2.65 cost (other
          bulbs sell at cost × 1.3). Imported as-is — confirm before relying on
          it.
        </p>
      ) : null}
      <ConsumableFields
        pending={pending}
        isMarketRate={isMarketRate}
        onMarketRateChange={setIsMarketRate}
        defaults={{
          description: row.description,
          sku: row.sku,
          category: row.category ?? "",
          manufacturer: row.manufacturer ?? "",
          partNumber: row.partNumber ?? "",
          unit: row.unit,
          wasteFactorPct: row.wasteFactorPct.toString(),
          baseCost: row.baseCost?.toString() ?? "",
          markupPct: row.markupPct.toString(),
          laborUnits: row.laborUnits.toString(),
          supplier: row.supplier ?? "",
          notes: row.notes ?? "",
          sortOrder: String(row.sortOrder),
          isActive: row.isActive,
        }}
      />
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          Sell (derived from saved values):{" "}
          {row.isMarketRate ? "Market rate" : money(sell)}
        </span>
        <span>
          Labor (derived): {money(blendedLaborRate)}/hr · cost{" "}
          {money(laborCost)} (units × blended rate)
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {canDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        ) : null}
        {error ? (
          <span className="text-sm text-destructive" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

type FieldDefaults = {
  description: string;
  sku: string;
  category: string;
  manufacturer: string;
  partNumber: string;
  unit: string;
  wasteFactorPct: string;
  baseCost: string;
  markupPct: string;
  laborUnits: string;
  supplier: string;
  notes: string;
  sortOrder: string;
  isActive: boolean;
};

function ConsumableFields({
  pending,
  isMarketRate,
  onMarketRateChange,
  defaults,
}: {
  pending: boolean;
  isMarketRate: boolean;
  onMarketRateChange: (v: boolean) => void;
  defaults: FieldDefaults;
}) {
  const id = defaults.sku || "new";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`desc-${id}`}>Description</Label>
          <Input
            id={`desc-${id}`}
            name="description"
            defaultValue={defaults.description}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sku-${id}`}>SKU</Label>
          <Input
            id={`sku-${id}`}
            name="sku"
            defaultValue={defaults.sku}
            disabled={pending}
            required
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`unit-${id}`}>Unit</Label>
          <Input
            id={`unit-${id}`}
            name="unit"
            defaultValue={defaults.unit}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`cat-${id}`}>Category</Label>
          <Input
            id={`cat-${id}`}
            name="category"
            defaultValue={defaults.category}
            disabled={pending}
            placeholder="IS only"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`mfr-${id}`}>Manufacturer</Label>
          <Input
            id={`mfr-${id}`}
            name="manufacturer"
            defaultValue={defaults.manufacturer}
            disabled={pending}
            placeholder="Cabin"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`pn-${id}`}>Part number</Label>
          <Input
            id={`pn-${id}`}
            name="partNumber"
            defaultValue={defaults.partNumber}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sup-${id}`}>Supplier</Label>
          <Input
            id={`sup-${id}`}
            name="supplier"
            defaultValue={defaults.supplier}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor={`waste-${id}`}>Waste (decimal, e.g. 0.10)</Label>
          <Input
            id={`waste-${id}`}
            name="wasteFactorPct"
            type="number"
            step="any"
            defaultValue={defaults.wasteFactorPct}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`base-${id}`}>Base cost</Label>
          <Input
            id={`base-${id}`}
            name="baseCost"
            type="number"
            step="any"
            defaultValue={defaults.baseCost}
            disabled={pending || isMarketRate}
            required={!isMarketRate}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`markup-${id}`}>Markup (decimal, e.g. 0.50)</Label>
          <Input
            id={`markup-${id}`}
            name="markupPct"
            type="number"
            step="any"
            defaultValue={defaults.markupPct}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`lu-${id}`}>Labor units (hours)</Label>
          <Input
            id={`lu-${id}`}
            name="laborUnits"
            type="number"
            step="any"
            defaultValue={defaults.laborUnits}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`sort-${id}`}>Sort</Label>
          <Input
            id={`sort-${id}`}
            name="sortOrder"
            type="number"
            defaultValue={defaults.sortOrder}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`notes-${id}`}>Notes</Label>
        <textarea
          id={`notes-${id}`}
          name="notes"
          defaultValue={defaults.notes}
          disabled={pending}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isMarketRate"
            checked={isMarketRate}
            onChange={(e) => onMarketRateChange(e.target.checked)}
            disabled={pending}
            className="size-4 rounded border"
          />
          Market rate (pass-through — no stored cost/sell)
        </label>
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
      </div>
    </>
  );
}
