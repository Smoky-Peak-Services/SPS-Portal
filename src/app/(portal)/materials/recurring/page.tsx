import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getRecurringForScope,
  getServicePlansForScope,
  listRecurringScopes,
} from "@/features/pricing/actions";
import { RecurringFeesTable } from "@/features/pricing/components/recurring-fees-table";
import { ServicePlanRatesTable } from "@/features/pricing/components/service-plan-rates-table";
import { resolvePageScope } from "@/features/pricing/scope-page";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { ScopeFilterBar } from "@/components/patterns/scope-filter-bar";

/**
 * Lives under Catalog chrome (`/materials/recurring`) but keeps `requireArea("pricing")`
 * — visual placement must not silently widen materials-only access.
 *
 * Per prompt 14 the content is scope-shaped: IS-Commercial shows RecurringFeeItem
 * (SMA + monthly services); Cabin Services shows ServicePlanRate tiers; IS-Residential
 * has no recurring pricing yet (empty state).
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

  const selectedDivision = divisions.find((d) => d.id === divisionId);
  const isCabin = selectedDivision?.slug === "cabin-services";

  if (isCabin && divisionId) {
    const scope = await getServicePlansForScope(divisionId, segment);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recurring fees"
          description="Cabin Services plan rates: monthly Maintenance, Inspection, and Full-Service packages by bedroom tier. Base package rates feed calculateAdjustedPackageRate."
        />

        <ScopeFilterBar
          divisions={divisions}
          divisionId={divisionId}
          segment={segment}
        />

        {scope.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No service plan rates for this scope. Seed with{" "}
            <code className="text-xs">npm run db:seed</code> or{" "}
            <code className="text-xs">scripts/run-seed-service-plans.ts</code>.
          </p>
        ) : (
          <Panel
            title={`${scope.division?.name ?? "Division"} · ${segment}`}
            description={`${scope.plans.length} plan rows`}
          >
            <ServicePlanRatesTable plans={scope.plans} canWrite={canWrite} />
          </Panel>
        )}
      </div>
    );
  }

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
          No recurring fees for this scope. IS-Residential has no recurring
          pricing yet. Seed IS-Commercial with{" "}
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
