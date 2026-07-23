"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createServiceLocation,
  deleteServiceLocation,
} from "@/features/crm/actions";
import {
  classificationLabel,
  locationDisplayName,
  serviceLineLabel,
  type ServiceLine,
} from "@/features/crm/service-location";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableShell } from "@/components/patterns/data-table-shell";

const CLASSIFICATION_OPTIONS = [
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "COMMERCIAL", label: "Commercial" },
];

type Location = {
  id: string;
  siteName: string | null;
  classification: "RESIDENTIAL" | "COMMERCIAL";
  serviceLines: ServiceLine[];
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
};

export function LocationsPanel({
  customerId,
  locations,
  canWrite,
  showCabinFields,
}: {
  customerId: string;
  locations: Location[];
  canWrite: boolean;
  showCabinFields: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <DataTableShell>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Classification</th>
              <th className="px-4 py-3">Service lines</th>
              <th className="px-4 py-3">Address</th>
              {canWrite ? (
                <th className="px-4 py-3 text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-b border-border/60">
                <td className="px-4 py-3">{locationDisplayName(loc)}</td>
                <td className="px-4 py-3">
                  {classificationLabel(loc.classification)}
                </td>
                <td className="px-4 py-3">
                  {loc.serviceLines.map(serviceLineLabel).join(", ")}
                </td>
                <td className="px-4 py-3">
                  {loc.line1}, {loc.city}, {loc.region} {loc.postalCode}
                </td>
                {canWrite ? (
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          await deleteServiceLocation({ id: loc.id });
                          router.refresh();
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {canWrite ? (
        <form
          className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const serviceLines = fd.getAll("serviceLines") as string[];
            start(async () => {
              const result = await createServiceLocation({
                customerId,
                siteName: fd.get("siteName"),
                classification: fd.get("classification"),
                serviceLines:
                  serviceLines.length > 0
                    ? serviceLines
                    : ["INTEGRATED_SYSTEMS"],
                line1: fd.get("line1"),
                line2: fd.get("line2"),
                city: fd.get("city"),
                region: fd.get("region"),
                postalCode: fd.get("postalCode"),
                bedrooms: fd.get("bedrooms") || null,
                bathrooms: fd.get("bathrooms") || null,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              e.currentTarget.reset();
              router.refresh();
            });
          }}
        >
          <Input name="siteName" placeholder="Site name" />
          <FormSelect
            name="classification"
            label="Classification"
            options={CLASSIFICATION_OPTIONS}
            defaultValue="RESIDENTIAL"
            required
          />
          <Input name="line1" placeholder="Street line 1" required />
          <Input name="line2" placeholder="Street line 2" />
          <Input name="city" placeholder="City" required />
          <Input name="region" placeholder="State" required />
          <Input name="postalCode" placeholder="Postal" required />
          <div className="flex flex-col gap-2 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Service lines</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="serviceLines"
                value="INTEGRATED_SYSTEMS"
                defaultChecked
              />
              Integrated Systems
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="serviceLines"
                value="CABIN_SERVICES"
              />
              Cabin Services
            </label>
          </div>
          {showCabinFields ? (
            <>
              <Input
                name="bedrooms"
                type="number"
                min={0}
                placeholder="Bedrooms"
              />
              <Input
                name="bathrooms"
                type="number"
                min={0}
                placeholder="Bathrooms"
              />
            </>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            Add service location
          </Button>
        </form>
      ) : null}
    </div>
  );
}
