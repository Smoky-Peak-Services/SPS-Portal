import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import {
  getComplexityForScope,
  listComplexityScopes,
} from "@/features/pricing/actions";
import { ComplexityMultipliersTable } from "@/features/pricing/components/complexity-multipliers-table";
import { resolvePageScope } from "@/features/pricing/scope-page";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { ScopeFilterBar } from "@/components/patterns/scope-filter-bar";

export default async function ComplexityMultipliersPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/complexity");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const params = await searchParams;

  const { divisions } = await listComplexityScopes();
  const { divisionId, segment } = resolvePageScope({
    divisionId: params.divisionId,
    segment: params.segment,
    divisions,
  });

  const scope = divisionId
    ? await getComplexityForScope(divisionId, segment)
    : { multipliers: [], division: null };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complexity multipliers"
        description="Hours-only adders for quoted labor. Adjusted hours feed distributeQuotedLabor later — never multiply dollars."
      />

      <ScopeFilterBar
        divisions={divisions}
        divisionId={divisionId}
        segment={segment}
      />

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
