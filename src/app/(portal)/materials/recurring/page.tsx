import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getRecurringForScope,
  getServicePlansForScope,
} from "@/features/pricing/actions";
import { RecurringFeesTable } from "@/features/pricing/components/recurring-fees-table";
import { ServicePlanRatesTable } from "@/features/pricing/components/service-plan-rates-table";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";

/**
 * Lives under Catalog chrome (`/materials/recurring`) but keeps `requireArea("pricing")`
 * — visual placement must not silently widen materials-only access.
 *
 * Scope-shaped: Cabin uses ServicePlanRate tiers; IS Commercial / Residential
 * (and any other non-Cabin scope) use RecurringFeeItem with full create/edit/delete
 * so empty sheets (e.g. Residential) can be built from the UI.
 */
export default async function RecurringFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/recurring");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const scope = await getActiveScope(await searchParams);
  const { divisionId, segment, divisionName } = scope;

  const isCabin = scope.divisionSlug === "cabin-services";

  if (isCabin) {
    const plans = await getServicePlansForScope(divisionId, segment);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recurring fees"
          description="Cabin Services plan rates: monthly Maintenance, Inspection, and Full-Service packages by bedroom tier. Base package rates feed calculateAdjustedPackageRate."
        />

        {plans.plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No service plan rates for this scope. Seed with{" "}
            <code className="text-xs">npm run db:seed</code> or{" "}
            <code className="text-xs">scripts/run-seed-service-plans.ts</code>.
          </p>
        ) : (
          <Panel
            title={`${divisionName} · ${segment}`}
            description={`${plans.plans.length} plan rows`}
          >
            <ServicePlanRatesTable
              key={`${divisionId}:${segment}`}
              plans={plans.plans}
              canWrite={canWrite}
            />
          </Panel>
        )}
      </div>
    );
  }

  const recurring = await getRecurringForScope(divisionId, segment);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring fees"
        description="SMA tiers, SVM, Bank of Hours, and monthly services — editable per scope. Add rows to build sheets that were not seeded (e.g. Residential). Engines: calculateAnnualSmaPrice / resolveMonthlyServiceRate."
      />

      <Panel
        title={`${divisionName} · ${segment}`}
        description={
          recurring.items.length === 0
            ? "Empty sheet — add fees below"
            : `${recurring.items.length} items`
        }
      >
        <RecurringFeesTable
          key={`${divisionId}:${segment}`}
          items={recurring.items}
          canWrite={canWrite}
          divisionId={divisionId}
          segment={segment}
        />
      </Panel>
    </div>
  );
}
