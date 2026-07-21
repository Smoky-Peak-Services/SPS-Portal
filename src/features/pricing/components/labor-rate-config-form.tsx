"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLaborRateConfig } from "@/features/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LaborRateConfigForm({
  config,
  canWrite,
}: {
  config: {
    id: string;
    burdenMultiplier: { toString(): string };
    commercialBillingMultiplier: { toString(): string };
    afterHoursMultiplier: { toString(): string };
    holidayMultiplier: { toString(): string };
  };
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        await updateLaborRateConfig({
          id: config.id,
          burdenMultiplier: fd.get("burdenMultiplier"),
          commercialBillingMultiplier: fd.get("commercialBillingMultiplier"),
          afterHoursMultiplier: fd.get("afterHoursMultiplier"),
          holidayMultiplier: fd.get("holidayMultiplier"),
        });
        setMessage("Config saved.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Rate multipliers</h2>
      <p className="text-xs text-muted-foreground">
        Document how stored position rates were derived. Runtime engines use the
        position columns, not these multipliers.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["burdenMultiplier", "Burden", config.burdenMultiplier],
            [
              "commercialBillingMultiplier",
              "Commercial billing",
              config.commercialBillingMultiplier,
            ],
            ["afterHoursMultiplier", "After hours", config.afterHoursMultiplier],
            ["holidayMultiplier", "Holiday", config.holidayMultiplier],
          ] as const
        ).map(([name, label, value]) => (
          <div key={name} className="space-y-1">
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              name={name}
              type="number"
              step="0.0001"
              defaultValue={value.toString()}
              disabled={!canWrite || pending}
              required
            />
          </div>
        ))}
      </div>
      {canWrite ? (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save multipliers"}
        </Button>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </form>
  );
}
