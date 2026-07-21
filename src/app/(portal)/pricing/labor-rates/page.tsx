import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getLaborRatesForScope,
  listLaborRateScopes,
} from "@/features/pricing/actions";
import { LaborRateConfigForm } from "@/features/pricing/components/labor-rate-config-form";
import { LaborPositionsTable } from "@/features/pricing/components/labor-positions-table";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function LaborRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/labor-rates");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const params = await searchParams;

  const { divisions, configs } = await listLaborRateScopes();

  const isDivision = divisions.find((d) => d.slug === "integrated-systems");
  const defaultDivisionId =
    params.divisionId ||
    configs.find((c) => c.segment === "COMMERCIAL")?.divisionId ||
    isDivision?.id ||
    divisions[0]?.id ||
    "";
  const segmentRaw = (params.segment ?? "COMMERCIAL").toUpperCase();
  const segment =
    segmentRaw === "RESIDENTIAL" || segmentRaw === "STR"
      ? segmentRaw
      : "COMMERCIAL";

  const scope = defaultDivisionId
    ? await getLaborRatesForScope(defaultDivisionId, segment)
    : { config: null, positions: [], division: null };

  const scopedConfigs = configs.filter((c) => c.divisionId === defaultDivisionId);
  const segmentOptions =
    scopedConfigs.length > 0
      ? scopedConfigs.map((c) => c.segment)
      : (["COMMERCIAL"] as const);

  const selectClass =
    "flex h-8 w-full min-w-[10rem] rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labor rates"
        description="Division + segment rate cards. Quoted blend uses INSTALL positions; service tickets use the SERVICE technician. No Excel — edit inline."
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
          <Panel title="Rate multipliers" description="Transparency / recompute only — stored position rates are authoritative at runtime.">
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
