"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCustomer } from "@/features/crm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DivisionOpt = { id: string; name: string; slug: string };

export function CreateCustomerForm({
  divisions,
}: {
  divisions: DivisionOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await createCustomer({
            type: fd.get("type"),
            displayName: fd.get("displayName"),
            divisionId: fd.get("divisionId"),
            mainPhone: fd.get("mainPhone"),
            generalEmail: fd.get("generalEmail"),
            website: fd.get("website"),
            summary: fd.get("summary"),
            source: fd.get("source"),
            notes: fd.get("notes"),
            hqLine1: fd.get("hqLine1"),
            hqLine2: fd.get("hqLine2"),
            hqCity: fd.get("hqCity"),
            hqRegion: fd.get("hqRegion"),
            hqPostal: fd.get("hqPostal"),
            contactFirstName: fd.get("contactFirstName"),
            contactLastName: fd.get("contactLastName"),
            contactEmail: fd.get("contactEmail"),
            contactPhone: fd.get("contactPhone"),
            contactRoleTag: fd.get("contactRoleTag") || undefined,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/clients/${result.id}`);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Customer type</Label>
          <select
            id="type"
            name="type"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue="RESIDENTIAL"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="STR">STR</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="divisionId">Owning division</Label>
          <select
            id="divisionId"
            name="divisionId"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue={divisions[0]?.id ?? ""}
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mainPhone">Main phone</Label>
          <Input id="mainPhone" name="mainPhone" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="generalEmail">General email</Label>
          <Input id="generalEmail" name="generalEmail" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">HQ address</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="hqLine1" placeholder="Line 1" />
          <Input name="hqLine2" placeholder="Line 2" />
          <Input name="hqCity" placeholder="City" />
          <Input name="hqRegion" placeholder="State" />
          <Input name="hqPostal" placeholder="Postal" />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">
          Primary contact (optional)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="contactFirstName" placeholder="First name" />
          <Input name="contactLastName" placeholder="Last name" />
          <Input name="contactEmail" type="email" placeholder="Email" />
          <Input name="contactPhone" placeholder="Phone" />
          <select
            name="contactRoleTag"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue="CLIENT"
          >
            <option value="CLIENT">Client</option>
            <option value="PROPERTY_MANAGER">Property manager</option>
            <option value="ESTIMATOR">Estimator</option>
            <option value="TENANT">Tenant</option>
          </select>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="summary">Initial request / summary</Label>
        <Textarea id="summary" name="summary" rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <Input type="hidden" name="source" value="MANUAL" />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create client"}
      </Button>
    </form>
  );
}
