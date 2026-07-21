import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getRecurringForScope,
  listRecurringScopes,
} from "@/features/pricing/actions";
import { RecurringFeesTable } from "@/features/pricing/components/recurring-fees-table";

export default async function RecurringFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/recurring");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const params = await searchParams;

  const { divisions, scopes } = await listRecurringScopes();

  const isDivision = divisions.find((d) => d.slug === "integrated-systems");
  const defaultDivisionId =
    params.divisionId ||
    scopes.find((s) => s.segment === "COMMERCIAL")?.divisionId ||
    isDivision?.id ||
    divisions[0]?.id ||
    "";
  const segmentRaw = (params.segment ?? "COMMERCIAL").toUpperCase();
  const segment =
    segmentRaw === "RESIDENTIAL" || segmentRaw === "STR"
      ? segmentRaw
      : "COMMERCIAL";

  const scope = defaultDivisionId
    ? await getRecurringForScope(defaultDivisionId, segment)
    : { items: [], division: null };

  const scopedSegments = scopes.filter((s) => s.divisionId === defaultDivisionId);
  const segmentOptions =
    scopedSegments.length > 0
      ? scopedSegments.map((s) => s.segment)
      : (["COMMERCIAL"] as const);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Recurring fees</h1>
        <p className="text-sm text-muted-foreground">
          SMA tiers, SVM, Bank of Hours, and monthly services for a division
          segment. Engines:{" "}
          <code className="text-xs">calculateAnnualSmaPrice</code> /{" "}
          <code className="text-xs">resolveMonthlyServiceRate</code>. See also{" "}
          <Link
            href="/pricing/labor-rates"
            className="text-primary hover:underline"
          >
            Labor rates
          </Link>{" "}
          (BOH uses Tech 1&amp;2) and{" "}
          <Link
            href="/pricing/complexity"
            className="text-primary hover:underline"
          >
            Complexity
          </Link>
          .
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="divisionId">
            Division
          </label>
          <select
            id="divisionId"
            name="divisionId"
            defaultValue={defaultDivisionId}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="segment">
            Segment
          </label>
          <select
            id="segment"
            name="segment"
            defaultValue={segment}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {segmentOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm hover:bg-muted"
        >
          Load
        </button>
      </form>

      {scope.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recurring fees for this scope. Seed IS-Commercial with{" "}
          <code className="text-xs">npm run db:seed</code> or{" "}
          <code className="text-xs">scripts/run-seed-recurring-fees.ts</code>.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {scope.division?.name ?? "Division"} · {segment} ·{" "}
            {scope.items.length} items
          </p>
          <RecurringFeesTable items={scope.items} canWrite={canWrite} />
        </>
      )}
    </div>
  );
}
