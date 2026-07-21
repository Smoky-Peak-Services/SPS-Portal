import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getRecurringForScope,
  listRecurringScopes,
} from "@/features/pricing/actions";
import { RecurringFeesTable } from "@/features/pricing/components/recurring-fees-table";
import { resolvePageScope } from "@/features/pricing/scope-page";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { ScopeFilterBar } from "@/components/patterns/scope-filter-bar";

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

  const { divisions } = await listRecurringScopes();
  const { divisionId, segment } = resolvePageScope({
    divisionId: params.divisionId,
    segment: params.segment,
    divisions,
  });

  const scope = divisionId
    ? await getRecurringForScope(divisionId, segment)
    : { items: [], division: null };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring fees"
        description="SMA tiers, SVM, Bank of Hours, and monthly services. Engines: calculateAnnualSmaPrice / resolveMonthlyServiceRate. Bank of Hours sell rate tracks Tech 1&2 × 0.90."
      />

      <ScopeFilterBar
        divisions={divisions}
        divisionId={divisionId}
        segment={segment}
      />

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
