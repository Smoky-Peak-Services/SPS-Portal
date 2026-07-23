"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createCustomer } from "@/features/crm/actions";
import { AddressAutocomplete } from "@/features/crm/components/address-autocomplete";
import {
  allowedDivisionSlugsForCustomerType,
  lockedDivisionSlugForCustomerType,
  type CustomerType,
} from "@/features/crm/service-location";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DivisionOpt = { id: string; name: string; slug: string };

const CUSTOMER_TYPE_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "STR", label: "STR" },
];

const CONTACT_ROLE_OPTIONS = [
  { value: "CLIENT", label: "Client / homeowner" },
  { value: "PROPERTY_MANAGER", label: "Property manager" },
  { value: "ESTIMATOR", label: "Estimator" },
  { value: "TENANT", label: "Tenant" },
];

export function CreateCustomerForm({
  divisions,
}: {
  divisions: DivisionOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<CustomerType>("RESIDENTIAL");
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");

  const allowedDivisions = useMemo(() => {
    const allowed = new Set(allowedDivisionSlugsForCustomerType(type));
    return divisions.filter((d) => allowed.has(d.slug as never));
  }, [type, divisions]);

  const lockedSlug = lockedDivisionSlugForCustomerType(type);
  const divisionLocked = lockedSlug != null;

  useEffect(() => {
    if (allowedDivisions.length === 0) return;
    if (!allowedDivisions.some((d) => d.id === divisionId)) {
      setDivisionId(allowedDivisions[0]!.id);
    }
  }, [allowedDivisions, divisionId]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!divisionId) {
          setError("Owning division is required.");
          return;
        }
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const result = await createCustomer({
            type,
            displayName: fd.get("displayName"),
            divisionId,
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
            hqLat: fd.get("hqLat"),
            hqLng: fd.get("hqLng"),
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
        <FormSelect
          id="type"
          name="type"
          label="Customer type"
          options={CUSTOMER_TYPE_OPTIONS}
          value={type}
          onValueChange={(v) => setType(v as CustomerType)}
          required
        />
        <div className="space-y-2">
          {divisionLocked ? (
            <>
              <Label htmlFor="divisionId">Owning division</Label>
              <Input
                id="divisionId"
                name="divisionId"
                value={divisionId}
                type="hidden"
                readOnly
              />
              <Input
                value={
                  allowedDivisions.find((d) => d.id === divisionId)?.name ??
                  "Not configured"
                }
                disabled
                readOnly
              />
            </>
          ) : (
            <FormSelect
              id="divisionId"
              name="divisionId"
              label="Owning division"
              options={allowedDivisions.map((d) => ({
                value: d.id,
                label: d.name,
              }))}
              value={divisionId}
              onValueChange={setDivisionId}
              required
            />
          )}
          <p className="text-xs text-muted-foreground">
            {type === "COMMERCIAL"
              ? "Commercial clients must use Integrated Systems."
              : type === "STR"
                ? "STR clients must use Cabin Services."
                : "Residential clients can use Integrated Systems or Cabin Services."}
          </p>
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
        />
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
          <FormSelect
            name="contactRoleTag"
            label="Role"
            options={CONTACT_ROLE_OPTIONS}
            defaultValue="CLIENT"
          />
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
      <Button type="submit" disabled={pending || !divisionId}>
        {pending ? "Creating…" : "Create client"}
      </Button>
    </form>
  );
}
