"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkContext } from "@prisma/client";
import { updateLaborPosition } from "@/features/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PositionRow = {
  id: string;
  title: string;
  sku: string;
  context: WorkContext;
  baseHourlyRate: { toString(): string };
  actualCostOfLabor: { toString(): string };
  standardBillingRate: { toString(): string };
  afterHoursRate: { toString(): string };
  holidayRate: { toString(): string };
  discountedRate: { toString(): string } | null;
  quotedAllocationPct: { toString(): string };
  sortOrder: number;
};

export function LaborPositionsTable({
  positions,
  canWrite,
}: {
  positions: PositionRow[];
  canWrite: boolean;
}) {
  // Discounted rate is a Cabin Services sheet column — only show when present.
  const hasDiscounted = positions.some((p) => p.discountedRate != null);

  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Title / SKU</th>
          <th className="px-3 py-2">Ctx</th>
          <th className="px-3 py-2">Base</th>
          <th className="px-3 py-2">Cost</th>
          <th className="px-3 py-2">Std</th>
          <th className="px-3 py-2">AH</th>
          <th className="px-3 py-2">Hol</th>
          {hasDiscounted ? <th className="px-3 py-2">Disc</th> : null}
          <th className="px-3 py-2">Alloc %</th>
          <th className="px-3 py-2">Sort</th>
          {canWrite ? <th className="px-3 py-2" /> : null}
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <PositionEditRow
            key={p.id}
            position={p}
            canWrite={canWrite}
            hasDiscounted={hasDiscounted}
          />
        ))}
      </tbody>
    </table>
  );
}

function PositionEditRow({
  position,
  canWrite,
  hasDiscounted,
}: {
  position: PositionRow;
  canWrite: boolean;
  hasDiscounted: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const colCount = 9 + (hasDiscounted ? 1 : 0) + (canWrite ? 1 : 0);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        await updateLaborPosition({
          id: position.id,
          title: fd.get("title"),
          baseHourlyRate: fd.get("baseHourlyRate"),
          actualCostOfLabor: fd.get("actualCostOfLabor"),
          standardBillingRate: fd.get("standardBillingRate"),
          afterHoursRate: fd.get("afterHoursRate"),
          holidayRate: fd.get("holidayRate"),
          ...(hasDiscounted
            ? { discountedRate: fd.get("discountedRate") }
            : {}),
          quotedAllocationPct: fd.get("quotedAllocationPct"),
          sortOrder: fd.get("sortOrder"),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  if (!canWrite) {
    return (
      <tr className="border-b last:border-0">
        <td className="px-3 py-2">
          <div className="font-medium">{position.title}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {position.sku}
          </div>
        </td>
        <td className="px-3 py-2 text-xs">{position.context}</td>
        <td className="px-3 py-2">{position.baseHourlyRate.toString()}</td>
        <td className="px-3 py-2">{position.actualCostOfLabor.toString()}</td>
        <td className="px-3 py-2">{position.standardBillingRate.toString()}</td>
        <td className="px-3 py-2">{position.afterHoursRate.toString()}</td>
        <td className="px-3 py-2">{position.holidayRate.toString()}</td>
        {hasDiscounted ? (
          <td className="px-3 py-2">
            {position.discountedRate?.toString() ?? "—"}
          </td>
        ) : null}
        <td className="px-3 py-2">{position.quotedAllocationPct.toString()}</td>
        <td className="px-3 py-2">{position.sortOrder}</td>
      </tr>
    );
  }

  const rateFields = [
    ["baseHourlyRate", position.baseHourlyRate.toString()],
    ["actualCostOfLabor", position.actualCostOfLabor.toString()],
    ["standardBillingRate", position.standardBillingRate.toString()],
    ["afterHoursRate", position.afterHoursRate.toString()],
    ["holidayRate", position.holidayRate.toString()],
  ] as const;

  const rateColCount = 6 + (hasDiscounted ? 1 : 0);

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2" colSpan={colCount}>
        <form
          onSubmit={onSubmit}
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: `minmax(10rem,1.4fr) 4.5rem repeat(${rateColCount}, minmax(4.5rem,1fr)) 4rem auto`,
          }}
        >
          <div className="space-y-1">
            <Input
              name="title"
              defaultValue={position.title}
              disabled={pending}
              required
            />
            <div className="font-mono text-xs text-muted-foreground">
              {position.sku} · {position.context}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {position.context}
          </div>
          {rateFields.map(([name, value]) => (
            <Input
              key={name}
              name={name}
              type="number"
              step="0.01"
              defaultValue={value}
              disabled={pending}
              required
            />
          ))}
          {hasDiscounted ? (
            <Input
              name="discountedRate"
              type="number"
              step="0.01"
              defaultValue={position.discountedRate?.toString() ?? ""}
              disabled={pending}
              placeholder="—"
            />
          ) : null}
          <Input
            name="quotedAllocationPct"
            type="number"
            step="0.01"
            defaultValue={position.quotedAllocationPct.toString()}
            disabled={pending}
            required
          />
          <Input
            name="sortOrder"
            type="number"
            step="1"
            defaultValue={position.sortOrder}
            disabled={pending}
            required
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "…" : "Save"}
          </Button>
        </form>
        {error ? (
          <p className="mt-1 text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
