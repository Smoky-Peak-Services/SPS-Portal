"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCustomerActivity } from "@/features/crm/actions";
import { locationDisplayName } from "@/features/crm/service-location";
import { FormSelect } from "@/components/patterns/form-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Activity = {
  id: string;
  type: string;
  body: string | null;
  createdAt: Date;
  serviceLocation: { id: string; siteName: string | null; line1: string } | null;
};

type LocationOpt = {
  id: string;
  siteName: string | null;
  line1: string;
};

export function ActivityPanel({
  customerId,
  activities,
  locations,
  canWrite,
}: {
  customerId: string;
  activities: Activity[];
  locations: LocationOpt[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {canWrite ? (
        <form
          className="space-y-3 rounded-md border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const result = await createCustomerActivity({
                customerId,
                body: fd.get("body"),
                serviceLocationId: fd.get("serviceLocationId") || "",
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
          <Textarea name="body" rows={3} placeholder="Add a note…" required />
          <FormSelect
            name="serviceLocationId"
            label="Scope"
            options={locations.map((loc) => ({
              value: loc.id,
              label: locationDisplayName(loc),
            }))}
            defaultValue=""
            allowEmpty
            emptyLabel="Whole account"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            Add note
          </Button>
        </form>
      ) : null}

      <ul className="space-y-3">
        {activities.length === 0 ? (
          <li className="text-sm text-muted-foreground">No activity yet.</li>
        ) : (
          activities.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-border/60 px-4 py-3 text-sm"
            >
              <div className="mb-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{a.type}</span>
                <span>·</span>
                <span>{new Date(a.createdAt).toLocaleString()}</span>
                {a.serviceLocation ? (
                  <>
                    <span>·</span>
                    <span>{locationDisplayName(a.serviceLocation)}</span>
                  </>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap">{a.body}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
