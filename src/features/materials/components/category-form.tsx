"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCategory,
  updateCategory,
} from "@/features/materials/actions";
import type { MaterialTaxProfile } from "@prisma/client";
import {
  StripeTaxCodeCombobox,
  type StripeTaxCodeOption,
} from "./stripe-tax-code-combobox";

type DomainOption = {
  id: string;
  name: string;
  segment: string;
  division: { name: string };
};

type Props = {
  domains: DomainOption[];
  taxCodes: StripeTaxCodeOption[];
  initial?: {
    id: string;
    domainId: string;
    name: string;
    slug: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    requiresManualPartNumber: boolean;
    taxProfile: MaterialTaxProfile;
    stripeTaxCodeId: string | null;
    laborInstallTaxCodeId: string | null;
    laborServiceTaxCodeId: string | null;
    taxReviewed: boolean;
  };
};

export function CategoryForm({ domains, taxCodes, initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        const base = {
          domainId: String(fd.get("domainId") || ""),
          name: String(fd.get("name") || ""),
          slug: String(fd.get("slug") || "") || undefined,
          description: String(fd.get("description") || ""),
          sortOrder: Number(fd.get("sortOrder") || 0),
          isActive: fd.get("isActive") === "on",
          requiresManualPartNumber: fd.get("requiresManualPartNumber") === "on",
          taxProfile: String(
            fd.get("taxProfile") || "REAL_PROPERTY",
          ) as MaterialTaxProfile,
          stripeTaxCodeId: String(fd.get("stripeTaxCodeId") || ""),
          laborInstallTaxCodeId: String(fd.get("laborInstallTaxCodeId") || ""),
          laborServiceTaxCodeId: String(fd.get("laborServiceTaxCodeId") || ""),
          taxReviewed: fd.get("taxReviewed") === "on",
        };
        if (initial) await updateCategory({ id: initial.id, ...base });
        else await createCategory(base);
        router.push("/materials/categories");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="domainId">Domain</Label>
        <select
          id="domainId"
          name="domainId"
          required
          defaultValue={initial?.domainId ?? domains[0]?.id}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.division.name} / {d.segment} / {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug (optional)</Label>
        <Input id="slug" name="slug" defaultValue={initial?.slug} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="taxProfile">Tax profile (default)</Label>
        <select
          id="taxProfile"
          name="taxProfile"
          defaultValue={initial?.taxProfile ?? "REAL_PROPERTY"}
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="REAL_PROPERTY">Real property</option>
          <option value="TPP">Tangible personal property</option>
        </select>
        <p className="text-xs text-slate-500">
          Default for new categories is real property (installed systems). Carve
          out software, patch cables, servers, workstations, hard drives as TPP.
        </p>
      </div>
      <StripeTaxCodeCombobox
        name="stripeTaxCodeId"
        label="Stripe tax code (default)"
        codes={taxCodes}
        defaultValue={initial?.stripeTaxCodeId}
      />
      <StripeTaxCodeCombobox
        name="laborInstallTaxCodeId"
        label="Labor tax code override — install"
        codes={taxCodes}
        defaultValue={initial?.laborInstallTaxCodeId}
      />
      <StripeTaxCodeCombobox
        name="laborServiceTaxCodeId"
        label="Labor tax code override — service"
        codes={taxCodes}
        defaultValue={initial?.laborServiceTaxCodeId}
      />
      <p className="text-xs text-slate-500">
        Leave blank to use the default derived from tax profile + install/service
        context. Set both to the same code only if this category&apos;s labor is
        always one type of work regardless of which job or ticket it&apos;s
        billed on (e.g. running cable is always installation labor).
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="requiresManualPartNumber"
            defaultChecked={initial?.requiresManualPartNumber ?? false}
          />
          Requires manual part number on quotes
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial?.isActive ?? true}
          />
          Active
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="taxReviewed"
            defaultChecked={initial?.taxReviewed ?? false}
          />
          Tax reviewed
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          defaultValue={initial?.sortOrder ?? 0}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : initial ? "Update category" : "Create category"}
      </Button>
    </form>
  );
}
