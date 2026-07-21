import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getRecurringForScope,
  listRecurringScopes,
} from "@/features/pricing/actions";
import { RecurringFeesTable } from "@/features/pricing/components/recurring-fees-table";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Lives under Catalog chrome (`/materials/recurring`) but keeps `requireArea("pricing")`
 * — visual placement must not silently widen materials-only access.
 */
export default async function RecurringFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/recurring");
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

  const selectClass =
    "flex h-8 w-full min-w-[10rem] rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring fees"
        description="SMA tiers, SVM, Bank of Hours, and monthly services. Engines: calculateAnnualSmaPrice / resolveMonthlyServiceRate. Bank of Hours sell rate tracks Tech 1&2 × 0.90."
      />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1.5">
          <Label htmlFor="divisionId">Division</Label>
          <select
            id="divisionId"
            name="divisionId"
            defaultValue={defaultDivisionId}
            className={selectClass}
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="segment">Segment</Label>
          <select
            id="segment"
            name="segment"
            defaultValue={segment}
            className={selectClass}
          >
            {segmentOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Load
        </Button>
      </form>

      {scope.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recurring fees for this scope. Seed IS-Commercial with{" "}
          <code className="text-xs">npm run db:seed</code> or{" "}
          <code className="text-xs">scripts/run-seed-recurring-fees.ts</code>.
        </p>
      ) : (
        <Panel
          title={`${scope.division?.name ?? "Division"} · ${segment}`}
          description={`${scope.items.length} items`}
        >
          <RecurringFeesTable items={scope.items} canWrite={canWrite} />
        </Panel>
      )}
    </div>
  );
}
