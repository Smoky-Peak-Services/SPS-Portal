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
import type { MaterialAttributeInputType } from "@prisma/client";

type Option = {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  initial?: {
    id: string;
    name: string;
    slug: string;
    inputType: MaterialAttributeInputType;
    unit: string | null;
    isActive: boolean;
    options: Option[];
  };
};

export function AttributeForm({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optPending, startOpt] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        const base = {
          name: String(fd.get("name") || ""),
          slug: String(fd.get("slug") || "") || undefined,
          inputType: String(fd.get("inputType") || "TEXT") as MaterialAttributeInputType,
          unit: String(fd.get("unit") || ""),
          isActive: fd.get("isActive") === "on",
        };
        if (initial) {
          await updateAttribute({ id: initial.id, ...base });
          router.refresh();
        } else {
          const attr = await createAttribute(base);
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
        className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={initial?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug (optional, globally unique)</Label>
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
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-60"
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
          {pending ? "Saving…" : initial ? "Update attribute" : "Create attribute"}
        </Button>
      </form>

      {initial &&
      (initial.inputType === "SELECT" ||
        initial.inputType === "MULTISELECT") ? (
        <div className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Options
          </h2>
          <ul className="divide-y text-sm">
            {initial.options.map((o) => (
              <li key={o.id} className="flex justify-between py-2">
                <span>
                  {o.label}{" "}
                  <span className="text-slate-400">({o.value})</span>
                </span>
                <span className="text-slate-400">
                  {o.isActive ? "active" : "inactive"}
                </span>
              </li>
            ))}
            {initial.options.length === 0 ? (
              <li className="py-2 text-slate-500">No options yet.</li>
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
            <Button type="submit" size="sm" disabled={optPending}>
              {optPending ? "Adding…" : "Add option"}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
