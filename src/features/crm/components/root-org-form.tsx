"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCustomer } from "@/features/crm/actions";
import { AddressAutocomplete } from "@/features/crm/components/address-autocomplete";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DivisionOpt = { id: string; name: string; slug: string };

type Customer = {
  id: string;
  type: "RESIDENTIAL" | "COMMERCIAL" | "STR";
  displayName: string;
  divisionId: string;
  generalEmail: string | null;
  mainPhone: string | null;
  website: string | null;
  summary: string | null;
  notes: string | null;
  source: string | null;
  hqLine1: string | null;
  hqLine2: string | null;
  hqCity: string | null;
  hqRegion: string | null;
  hqPostal: string | null;
  hqLat: number | null;
  hqLng: number | null;
};

const CUSTOMER_TYPE_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "STR", label: "STR" },
];

export function RootOrgForm({
  customer,
  divisions,
  canWrite,
}: {
  customer: Customer;
  divisions: DivisionOpt[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canWrite) {
    return (
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd>{customer.displayName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd>{customer.type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{customer.mainPhone || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{customer.generalEmail || "—"}</dd>
        </div>
      </dl>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await updateCustomer({
            id: customer.id,
            type: fd.get("type"),
            displayName: fd.get("displayName"),
            divisionId: fd.get("divisionId"),
            mainPhone: fd.get("mainPhone"),
            generalEmail: fd.get("generalEmail"),
            website: fd.get("website"),
            summary: fd.get("summary"),
            notes: fd.get("notes"),
            source: fd.get("source"),
            hqLine1: fd.get("hqLine1"),
            hqLine2: fd.get("hqLine2"),
            hqCity: fd.get("hqCity"),
            hqRegion: fd.get("hqRegion"),
            hqPostal: fd.get("hqPostal"),
            hqLat: fd.get("hqLat"),
            hqLng: fd.get("hqLng"),
            useAsBillingAddress: fd.get("useAsBillingAddress") === "on",
            createServiceLocationFromRoot:
              fd.get("createServiceLocationFromRoot") === "on",
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setMessage("Saved.");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={customer.displayName}
            required
          />
        </div>
        <FormSelect
          id="type"
          name="type"
          label="Type"
          options={CUSTOMER_TYPE_OPTIONS}
          defaultValue={customer.type}
          required
        />
        <FormSelect
          id="divisionId"
          name="divisionId"
          label="Owning division"
          options={divisions.map((d) => ({ value: d.id, label: d.name }))}
          defaultValue={customer.divisionId}
          required
        />
        <div className="space-y-2">
          <Label htmlFor="mainPhone">Main phone</Label>
          <Input
            id="mainPhone"
            name="mainPhone"
            defaultValue={customer.mainPhone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="generalEmail">General email</Label>
          <Input
            id="generalEmail"
            name="generalEmail"
            type="email"
            defaultValue={customer.generalEmail ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            name="website"
            defaultValue={customer.website ?? ""}
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Root address</legend>
        <AddressAutocomplete
          names={{
            line1: "hqLine1",
            line2: "hqLine2",
            city: "hqCity",
            region: "hqRegion",
            postal: "hqPostal",
            lat: "hqLat",
            lon: "hqLng",
          }}
          defaults={{
            line1: customer.hqLine1 ?? "",
            line2: customer.hqLine2 ?? "",
            city: customer.hqCity ?? "",
            region: customer.hqRegion ?? "",
            postal: customer.hqPostal ?? "",
            lat: customer.hqLat != null ? String(customer.hqLat) : "",
            lon: customer.hqLng != null ? String(customer.hqLng) : "",
          }}
        />
        <div className="space-y-2 border-t border-border pt-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="useAsBillingAddress"
              className="mt-0.5"
            />
            <span>
              Use this address as the billing address (copies name, email, phone,
              and address into Billing information on save)
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="createServiceLocationFromRoot"
              className="mt-0.5"
            />
            <span>
              Also add this root address and primary contact as a service
              location (skipped if an identical address already exists)
            </span>
          </label>
        </div>
      </fieldset>

      <Textarea
        name="summary"
        placeholder="Summary"
        defaultValue={customer.summary ?? ""}
        rows={3}
      />
      <Textarea
        name="notes"
        placeholder="Account notes (visible on profile)"
        defaultValue={customer.notes ?? ""}
        rows={2}
      />
      <Input type="hidden" name="source" defaultValue={customer.source ?? ""} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save client profile"}
      </Button>
    </form>
  );
}
