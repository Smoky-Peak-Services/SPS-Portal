import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getComplexityForScope,
  listComplexityScopes,
} from "@/features/pricing/actions";
import { ComplexityMultipliersTable } from "@/features/pricing/components/complexity-multipliers-table";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function ComplexityMultipliersPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/complexity");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const params = await searchParams;

  const { divisions, scopes } = await listComplexityScopes();

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
    ? await getComplexityForScope(defaultDivisionId, segment)
    : { multipliers: [], division: null };

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
        title="Complexity multipliers"
        description="Hours-only adders for quoted labor. Adjusted hours feed distributeQuotedLabor later — never multiply dollars."
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

      {scope.multipliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No complexity multipliers for this scope. Seed IS-Commercial with{" "}
          <code className="text-xs">npm run db:seed</code> or{" "}
          <code className="text-xs">scripts/run-seed-complexity-multipliers.ts</code>.
        </p>
      ) : (
        <Panel
          title={`${scope.division?.name ?? "Division"} · ${segment}`}
          description={`${scope.multipliers.length} multipliers`}
        >
          <ComplexityMultipliersTable
            multipliers={scope.multipliers}
            canWrite={canWrite}
          />
        </Panel>
      )}
    </div>
  );
}
