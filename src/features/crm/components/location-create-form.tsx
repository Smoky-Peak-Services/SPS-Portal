"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLocation } from "@/features/crm/actions";

export function LocationCreateForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Add service location
      </Button>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await createLocation({
          customerId,
          siteName: String(fd.get("siteName") || ""),
          line1: String(fd.get("line1") || ""),
          line2: String(fd.get("line2") || ""),
          city: String(fd.get("city") || ""),
          region: String(fd.get("region") || ""),
          postalCode: String(fd.get("postalCode") || ""),
          classification: String(fd.get("classification") || "RESIDENTIAL"),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="siteName">Site name</Label>
          <Input id="siteName" name="siteName" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="classification">Class</Label>
          <select
            id="classification"
            name="classification"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="RESIDENTIAL">Residential</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="line1">Address</Label>
        <Input id="line1" name="line1" required />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="region">Region</Label>
          <Input id="region" name="region" defaultValue="TN" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="postalCode">Postal</Label>
          <Input id="postalCode" name="postalCode" required />
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save location"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
