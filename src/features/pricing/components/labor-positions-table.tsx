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
          <th className="px-3 py-2">Alloc %</th>
          <th className="px-3 py-2">Sort</th>
          {canWrite ? <th className="px-3 py-2" /> : null}
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <PositionEditRow key={p.id} position={p} canWrite={canWrite} />
        ))}
      </tbody>
    </table>
  );
}

function PositionEditRow({
  position,
  canWrite,
}: {
  position: PositionRow;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        <td className="px-3 py-2">{position.quotedAllocationPct.toString()}</td>
        <td className="px-3 py-2">{position.sortOrder}</td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2" colSpan={canWrite ? 10 : 9}>
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-[minmax(10rem,1.4fr)_4.5rem_repeat(6,minmax(4.5rem,1fr))_4rem_auto] items-end gap-2"
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
          <div className="text-xs text-muted-foreground">{position.context}</div>
          {(
            [
              ["baseHourlyRate", position.baseHourlyRate],
              ["actualCostOfLabor", position.actualCostOfLabor],
              ["standardBillingRate", position.standardBillingRate],
              ["afterHoursRate", position.afterHoursRate],
              ["holidayRate", position.holidayRate],
              ["quotedAllocationPct", position.quotedAllocationPct],
            ] as const
          ).map(([name, value]) => (
            <Input
              key={name}
              name={name}
              type="number"
              step="0.01"
              defaultValue={value.toString()}
              disabled={pending}
              required
            />
          ))}
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
