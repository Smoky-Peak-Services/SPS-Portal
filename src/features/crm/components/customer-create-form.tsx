"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer } from "@/features/crm/actions";

type Division = { id: string; name: string };

export function CustomerCreateForm({ divisions }: { divisions: Division[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const customer = await createCustomer({
          displayName: String(fd.get("displayName") || ""),
          type: String(fd.get("type") || "RESIDENTIAL"),
          divisionId: String(fd.get("divisionId") || ""),
          generalEmail: String(fd.get("generalEmail") || ""),
          mainPhone: String(fd.get("mainPhone") || ""),
          hqLine1: String(fd.get("hqLine1") || ""),
          hqCity: String(fd.get("hqCity") || ""),
          hqRegion: String(fd.get("hqRegion") || ""),
          hqPostal: String(fd.get("hqPostal") || ""),
        });
        router.push(`/clients/${customer.id}`);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create customer",
        );
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" name="displayName" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="STR">STR</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="divisionId">Division</Label>
          <select
            id="divisionId"
            name="divisionId"
            required
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="generalEmail">Email</Label>
          <Input id="generalEmail" name="generalEmail" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mainPhone">Phone</Label>
          <Input id="mainPhone" name="mainPhone" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hqLine1">Address</Label>
        <Input id="hqLine1" name="hqLine1" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hqCity">City</Label>
          <Input id="hqCity" name="hqCity" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hqRegion">Region</Label>
          <Input id="hqRegion" name="hqRegion" defaultValue="TN" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hqPostal">Postal</Label>
          <Input id="hqPostal" name="hqPostal" />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create client"}
      </Button>
    </form>
  );
}
