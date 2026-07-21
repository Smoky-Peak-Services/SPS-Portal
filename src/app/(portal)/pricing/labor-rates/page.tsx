import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getLaborRatesForScope,
  listLaborRateScopes,
} from "@/features/pricing/actions";
import { LaborRateConfigForm } from "@/features/pricing/components/labor-rate-config-form";
import { LaborPositionsTable } from "@/features/pricing/components/labor-positions-table";
import { resolvePageScope } from "@/features/pricing/scope-page";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { ScopeFilterBar } from "@/components/patterns/scope-filter-bar";

export default async function LaborRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/labor-rates");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const params = await searchParams;

  const { divisions } = await listLaborRateScopes();
  const { divisionId, segment } = resolvePageScope({
    divisionId: params.divisionId,
    segment: params.segment,
    divisions,
  });

  const scope = divisionId
    ? await getLaborRatesForScope(divisionId, segment)
    : { config: null, positions: [], division: null };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labor rates"
        description="Division + segment rate cards. Quoted blend uses INSTALL positions; service tickets use the SERVICE technician. No Excel — edit inline."
      />

      <ScopeFilterBar
        divisions={divisions}
        divisionId={divisionId}
        segment={segment}
      />

      {!scope.config ? (
        <p className="text-sm text-muted-foreground">
          No labor rate config for this scope yet. Seed IS-Commercial with{" "}
          <code className="text-xs">npm run db:seed</code> (or{" "}
          <code className="text-xs">scripts/run-seed-labor-rates.ts</code>).
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {scope.division?.name ?? "Division"} · {segment}
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
