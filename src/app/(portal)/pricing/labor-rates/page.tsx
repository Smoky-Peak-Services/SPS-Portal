import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import { getLaborRatesForScope } from "@/features/pricing/actions";
import { LaborRateConfigForm } from "@/features/pricing/components/labor-rate-config-form";
import { LaborPositionsTable } from "@/features/pricing/components/labor-positions-table";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { DataTableShell } from "@/components/patterns/data-table-shell";

export default async function LaborRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/labor-rates");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const { divisionId, segment, divisionName } = await getActiveScope(
    await searchParams,
  );

  const scope = await getLaborRatesForScope(divisionId, segment);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labor rates"
        description="Division + segment rate cards. Base rate + the scope multipliers are the inputs; every other rate column is derived from them. Quoted blend uses INSTALL positions; service tickets use the SERVICE technician."
      />

      {!scope.config ? (
        <p className="text-sm text-muted-foreground">
          No labor rate config for the {divisionName} · {segment} scope yet.
          Seed all scopes with <code className="text-xs">npm run db:seed</code>{" "}
          (or <code className="text-xs">scripts/run-seed-labor-rates.ts</code>).
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {divisionName} · {segment}
          </p>
          <Panel
            title="Rate multipliers"
            description={`These apply only to ${divisionName} · ${segment}. Base × Burden = Cost; Cost × Standard billing = Standard rate; After-hours, Holiday, and Discounted multiply the Standard rate. Saving recomputes positions in this scope only — other rate sheets are untouched.`}
          >
            {/* key forces a remount on scope change so uncontrolled inputs
                don't keep the previous sheet's defaultValue. */}
            <LaborRateConfigForm
              key={scope.config.id}
              config={scope.config}
              canWrite={canWrite}
            />
          </Panel>
          <DataTableShell
            title="Positions"
            description="Base is the only manual rate (today an average of what the role is paid; later derived from employee profiles). Cost / Std / AH / Hol are computed from Base × the multipliers above. INSTALL roles feed the quoted blend engine; SERVICE is service-ticket only."
          >
            <LaborPositionsTable
              key={scope.config.id}
              positions={scope.positions}
              multipliers={{
                burdenMultiplier: Number(scope.config.burdenMultiplier),
                standardBillingMultiplier: Number(
                  scope.config.standardBillingMultiplier,
                ),
                afterHoursMultiplier: Number(scope.config.afterHoursMultiplier),
                holidayMultiplier: Number(scope.config.holidayMultiplier),
                discountedMultiplier:
                  scope.config.discountedMultiplier == null
                    ? null
                    : Number(scope.config.discountedMultiplier),
              }}
              canWrite={canWrite}
            />
          </DataTableShell>
        </>
      )}
    </div>
  );
}
