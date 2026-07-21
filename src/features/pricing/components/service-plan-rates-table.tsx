"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ServicePlanType } from "@prisma/client";
import { updateServicePlanRate } from "@/features/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PlanRow = {
  id: string;
  planType: ServicePlanType;
  sku: string;
  description: string;
  bedrooms: number | null;
  maxBathrooms: number | null;
  rate: { toString(): string } | null;
  isCustomQuote: boolean;
  isActive: boolean;
  sortOrder: number;
};

const PLAN_TYPE_LABELS: Record<ServicePlanType, string> = {
  MAINTENANCE: "Maintenance plans",
  INSPECTION: "Inspection plans",
  FULL_SERVICE: "Full-service plans (maintenance & inspection)",
};

const PLAN_TYPE_ORDER: ServicePlanType[] = [
  "MAINTENANCE",
  "INSPECTION",
  "FULL_SERVICE",
];

export function ServicePlanRatesTable({
  plans,
  canWrite,
}: {
  plans: PlanRow[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-5">
      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Monthly base package rates per bedroom tier. Complexity multipliers
        applied to the{" "}
        <strong className="text-foreground">base package rate</strong> adjust
        these via calculateAdjustedPackageRate. Custom-quote rows are priced per
        property.
      </p>
      {PLAN_TYPE_ORDER.map((planType) => {
        const rows = plans.filter((p) => p.planType === planType);
        if (rows.length === 0) return null;
        return (
          <div key={planType} className="space-y-2">
            <h3 className="text-sm font-medium">
              {PLAN_TYPE_LABELS[planType]}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Bedrooms
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Max baths
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Rate</th>
                    {canWrite ? <th className="px-3 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ServicePlanRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServicePlanRow({
  row,
  canWrite,
}: {
  row: PlanRow;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(row.rate?.toString() ?? "");

  function save() {
    if (!canWrite) return;
    setError(null);
    start(async () => {
      try {
        await updateServicePlanRate({
          id: row.id,
          rate,
          isActive: row.isActive,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2">
        {row.description}
        {!row.isActive ? (
          <span className="ml-2 text-xs text-muted-foreground">inactive</span>
        ) : null}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
      <td className="px-3 py-2 text-right">{row.bedrooms ?? "-"}</td>
      <td className="px-3 py-2 text-right">{row.maxBathrooms ?? "-"}</td>
      <td className="px-3 py-2 text-right">
        {row.isCustomQuote ? (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Quoted
          </span>
        ) : canWrite ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            disabled={pending}
            className="ml-auto h-8 w-24 text-right"
            aria-label={`Rate for ${row.sku}`}
          />
        ) : (
          `$${Number(row.rate?.toString() ?? 0).toFixed(2)}`
        )}
      </td>
      {canWrite ? (
        <td className="px-3 py-2 text-right">
          {row.isCustomQuote ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={save}
              disabled={pending}
            >
              {pending ? "…" : "Save"}
            </Button>
          )}
          {error ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}
