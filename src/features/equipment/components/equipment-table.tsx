"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEquipment,
  deleteEquipment,
  updateEquipment,
} from "@/features/equipment/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Row = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  supplier: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
};

function readForm(fd: FormData) {
  return {
    name: fd.get("name"),
    sku: fd.get("sku"),
    unit: fd.get("unit"),
    supplier: fd.get("supplier"),
    notes: fd.get("notes"),
    isActive: fd.get("isActive") === "on",
    sortOrder: fd.get("sortOrder"),
  };
}

export function EquipmentTable({
  items,
  divisionId,
  divisionName,
  canWrite,
  canDelete,
}: {
  items: Row[];
  divisionId: string;
  divisionName: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        One equipment &amp; tools picklist for all of{" "}
        <strong className="text-foreground">{divisionName}</strong> (shared
        across its segments). Catalog items are placeholders (e.g. Scissor Lift
        Rental) —{" "}
        <strong className="text-foreground">
          cost is entered on the quote or service ticket
        </strong>
        , then sell = cost × 1.15 (fixed in code, not editable here).
      </p>

      {canWrite ? <AddEquipmentForm divisionId={divisionId} /> : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No equipment or tools for this division yet — add one.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <EquipmentEditCard
              key={item.id}
              row={item}
              canWrite={canWrite}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddEquipmentForm({ divisionId }: { divisionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await createEquipment({ divisionId, ...readForm(fd) });
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
        Add equipment
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-primary/40 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">New equipment / tool</h3>
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
      <EquipmentFields
        pending={pending}
        defaults={{
          name: "",
          sku: "",
          unit: "EACH",
          supplier: "",
          notes: "",
          sortOrder: "0",
          isActive: true,
        }}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Create"}
      </Button>
    </form>
  );
}

function EquipmentEditCard({
  row,
  canWrite,
  canDelete,
}: {
  row: Row;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateEquipment({ id: row.id, ...readForm(fd) });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function onDelete() {
    if (!canDelete) return;
    if (
      !window.confirm(`Delete "${row.name}"? This cannot be undone.`)
    ) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await deleteEquipment({ id: row.id });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{row.name}</h3>
          {row.sku ? (
            <p className="text-xs text-muted-foreground">SKU {row.sku}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={onDelete}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      <EquipmentFields
        pending={pending || !canWrite}
        defaults={{
          name: row.name,
          sku: row.sku ?? "",
          unit: row.unit ?? "",
          supplier: row.supplier ?? "",
          notes: row.notes ?? "",
          sortOrder: String(row.sortOrder),
          isActive: row.isActive,
        }}
        readOnly={!canWrite}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function EquipmentFields({
  pending,
  defaults,
  readOnly = false,
}: {
  pending: boolean;
  defaults: {
    name: string;
    sku: string;
    unit: string;
    supplier: string;
    notes: string;
    sortOrder: string;
    isActive: boolean;
  };
  readOnly?: boolean;
}) {
  const disabled = pending || readOnly;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Name" htmlFor="eq-name" required>
        <Input
          id="eq-name"
          name="name"
          required
          disabled={disabled}
          defaultValue={defaults.name}
        />
      </Field>
      <Field label="SKU" htmlFor="eq-sku">
        <Input
          id="eq-sku"
          name="sku"
          disabled={disabled}
          defaultValue={defaults.sku}
          placeholder="optional"
        />
      </Field>
      <Field label="Unit" htmlFor="eq-unit">
        <Input
          id="eq-unit"
          name="unit"
          disabled={disabled}
          defaultValue={defaults.unit}
          placeholder="EACH"
        />
      </Field>
      <Field label="Supplier" htmlFor="eq-supplier">
        <Input
          id="eq-supplier"
          name="supplier"
          disabled={disabled}
          defaultValue={defaults.supplier}
        />
      </Field>
      <Field label="Sort order" htmlFor="eq-sort">
        <Input
          id="eq-sort"
          name="sortOrder"
          type="number"
          step="1"
          disabled={disabled}
          defaultValue={defaults.sortOrder}
        />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaults.isActive}
            disabled={disabled}
            className="size-4 rounded border-border"
          />
          Active
        </label>
      </div>
      <Field
        label="Notes"
        htmlFor="eq-notes"
        className="sm:col-span-2 lg:col-span-3"
      >
        <Input
          id="eq-notes"
          name="notes"
          disabled={disabled}
          defaultValue={defaults.notes}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}
