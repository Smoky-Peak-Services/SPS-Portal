"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createItem, updateItem } from "@/features/materials/actions";
import type { MaterialTaxProfile } from "@prisma/client";

type Unit = { id: string; code: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  domain: { name: string; division: { name: string } };
};

type Assignment = {
  attributeId: string;
  isRequired: boolean;
  attribute: {
    id: string;
    name: string;
    slug: string;
    inputType: string;
    unit: string | null;
    options: { id: string; value: string; label: string }[];
  };
};

type ExistingValue = {
  attributeId: string;
  optionId: string | null;
  valueText: string | null;
  valueNumber: { toString(): string } | number | null;
  valueBool: boolean | null;
};

type Props = {
  categories: CategoryOption[];
  units: Unit[];
  /** Assignments for the selected category (loaded for edit, or empty on create until category chosen via page). */
  assignments: Assignment[];
  defaultCategoryId?: string;
  initial?: {
    id: string;
    categoryId: string;
    unitId: string;
    name: string;
    laborUnits: { toString(): string } | number;
    laborUnitNotes: string | null;
    isConsumable: boolean;
    baseCost: { toString(): string } | number | null;
    markupPct: { toString(): string } | number | null;
    wasteFactorPct: { toString(): string } | number | null;
    supplier: string | null;
    notes: string | null;
    isActive: boolean;
    taxProfile: MaterialTaxProfile | null;
    stripeTaxCode: string | null;
    values: ExistingValue[];
  };
};

function numStr(v: { toString(): string } | number | null | undefined) {
  if (v == null) return "";
  return typeof v === "number" ? String(v) : v.toString();
}

export function ItemForm({
  categories,
  units,
  assignments,
  defaultCategoryId,
  initial,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [isConsumable, setIsConsumable] = useState(
    initial?.isConsumable ?? false,
  );
  const isEdit = !!initial?.id;

  const valueMap = useMemo(() => {
    const m = new Map<string, ExistingValue>();
    for (const v of initial?.values ?? []) m.set(v.attributeId, v);
    return m;
  }, [initial?.values]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    const attributeValues = assignments.map((a) => {
      const id = a.attributeId;
      const type = a.attribute.inputType;
      if (type === "SELECT") {
        return {
          attributeId: id,
          optionId: String(fd.get(`attr_${id}_option`) || "") || null,
        };
      }
      if (type === "MULTISELECT") {
        const selected = fd.getAll(`attr_${id}_multi`).map(String);
        return {
          attributeId: id,
          valueText: selected.length ? JSON.stringify(selected) : null,
        };
      }
      if (type === "TEXT") {
        return {
          attributeId: id,
          valueText: String(fd.get(`attr_${id}_text`) || "") || null,
        };
      }
      if (type === "NUMBER") {
        const raw = String(fd.get(`attr_${id}_number`) || "");
        return {
          attributeId: id,
          valueNumber: raw === "" ? null : Number(raw),
        };
      }
      if (type === "BOOLEAN") {
        return {
          attributeId: id,
          valueBool: fd.get(`attr_${id}_bool`) === "on",
        };
      }
      return { attributeId: id };
    });

    const taxRaw = String(fd.get("taxProfile") || "");
    start(async () => {
      try {
        const baseCostRaw = String(fd.get("baseCost") || "");
        const markupRaw = String(fd.get("markupPct") || "");
        const wasteRaw = String(fd.get("wasteFactorPct") || "");
        const payload = {
          categoryId: String(fd.get("categoryId") || ""),
          unitId: String(fd.get("unitId") || ""),
          name: String(fd.get("name") || ""),
          laborUnits: Number(fd.get("laborUnits") || 0),
          laborUnitNotes: String(fd.get("laborUnitNotes") || ""),
          isConsumable: fd.get("isConsumable") === "on",
          baseCost: baseCostRaw === "" ? null : Number(baseCostRaw),
          markupPct: markupRaw === "" ? null : Number(markupRaw),
          wasteFactorPct: wasteRaw === "" ? null : Number(wasteRaw),
          supplier: String(fd.get("supplier") || ""),
          notes: String(fd.get("notes") || ""),
          isActive: fd.get("isActive") === "on",
          taxProfile:
            taxRaw === ""
              ? null
              : (taxRaw as MaterialTaxProfile),
          stripeTaxCode: String(fd.get("stripeTaxCode") || ""),
          attributeValues,
        };

        if (isEdit) await updateItem({ ...payload, id: initial!.id });
        else await createItem(payload);
        router.push("/materials/items");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={isEdit}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-60"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.domain.division.name} / {c.domain.name} / {c.name}
            </option>
          ))}
        </select>
        {!isEdit && !defaultCategoryId ? (
          <p className="text-xs text-slate-500">
            Tip: open a category and use &quot;New item in category&quot; so
            attribute fields load for that category.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unitId">Unit</Label>
          <select
            id="unitId"
            name="unitId"
            required
            defaultValue={initial?.unitId ?? units[0]?.id}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="laborUnits">Labor units (hours)</Label>
          <Input
            id="laborUnits"
            name="laborUnits"
            type="number"
            step="0.0001"
            defaultValue={numStr(initial?.laborUnits) || "0"}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="laborUnitNotes">Labor notes</Label>
        <Input
          id="laborUnitNotes"
          name="laborUnitNotes"
          defaultValue={initial?.laborUnitNotes ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isConsumable"
          checked={isConsumable}
          onChange={(e) => setIsConsumable(e.target.checked)}
        />
        Consumable (cost fields apply)
      </label>
      {isConsumable ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="baseCost">Base cost</Label>
            <Input
              id="baseCost"
              name="baseCost"
              type="number"
              step="0.01"
              defaultValue={numStr(initial?.baseCost)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="markupPct">Markup %</Label>
            <Input
              id="markupPct"
              name="markupPct"
              type="number"
              step="0.0001"
              defaultValue={numStr(initial?.markupPct)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wasteFactorPct">Waste %</Label>
            <Input
              id="wasteFactorPct"
              name="wasteFactorPct"
              type="number"
              step="0.0001"
              defaultValue={numStr(initial?.wasteFactorPct)}
            />
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="taxProfile">Tax profile override</Label>
          <select
            id="taxProfile"
            name="taxProfile"
            defaultValue={initial?.taxProfile ?? ""}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">Inherit category</option>
            <option value="TPP">TPP</option>
            <option value="REAL_PROPERTY">Real property</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stripeTaxCode">Stripe tax code override</Label>
          <Input
            id="stripeTaxCode"
            name="stripeTaxCode"
            placeholder="blank = inherit"
            defaultValue={initial?.stripeTaxCode ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="supplier">Supplier</Label>
        <Input
          id="supplier"
          name="supplier"
          defaultValue={initial?.supplier ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
        />
        Active
      </label>

      {assignments.length > 0 ? (
        <div className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Attributes
          </h2>
          {assignments.map((a) => {
            const existing = valueMap.get(a.attributeId);
            const type = a.attribute.inputType;
            return (
              <div key={a.attributeId} className="space-y-1">
                <Label>
                  {a.attribute.name}
                  {a.isRequired ? " *" : ""}
                </Label>
                {type === "SELECT" ? (
                  <select
                    name={`attr_${a.attributeId}_option`}
                    defaultValue={existing?.optionId ?? ""}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">—</option>
                    {a.attribute.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {type === "MULTISELECT" ? (
                  <div className="space-y-1 rounded-md border border-slate-200 p-2">
                    {(() => {
                      let selected: string[] = [];
                      if (existing?.valueText) {
                        try {
                          selected = JSON.parse(existing.valueText) as string[];
                        } catch {
                          selected = [];
                        }
                      }
                      return a.attribute.options.map((o) => (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name={`attr_${a.attributeId}_multi`}
                            value={o.value}
                            defaultChecked={selected.includes(o.value)}
                          />
                          {o.label}
                        </label>
                      ));
                    })()}
                  </div>
                ) : null}
                {type === "TEXT" ? (
                  <Input
                    name={`attr_${a.attributeId}_text`}
                    defaultValue={existing?.valueText ?? ""}
                  />
                ) : null}
                {type === "NUMBER" ? (
                  <Input
                    name={`attr_${a.attributeId}_number`}
                    type="number"
                    step="any"
                    defaultValue={numStr(existing?.valueNumber)}
                  />
                ) : null}
                {type === "BOOLEAN" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={`attr_${a.attributeId}_bool`}
                      defaultChecked={existing?.valueBool ?? false}
                    />
                    Yes
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : isEdit ? "Update item" : "Create item"}
      </Button>
    </form>
  );
}
