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
        description="Division + segment rate cards. Quoted blend uses INSTALL positions; service tickets use the SERVICE technician. No Excel — edit inline."
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
            description="Transparency / recompute only — stored position rates are authoritative at runtime."
          >
            <LaborRateConfigForm config={scope.config} canWrite={canWrite} />
          </Panel>
          <DataTableShell
            title="Positions"
            description="INSTALL roles feed the quoted blend engine; SERVICE is service-ticket only (never in quote distribution)."
          >
            <LaborPositionsTable
              positions={scope.positions}
              canWrite={canWrite}
            />
          </DataTableShell>
        </>
      )}
    </div>
  );
}
