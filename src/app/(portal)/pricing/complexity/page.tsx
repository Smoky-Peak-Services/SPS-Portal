import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import { getComplexityForScope } from "@/features/pricing/actions";
import { ComplexityMultipliersTable } from "@/features/pricing/components/complexity-multipliers-table";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";

export default async function ComplexityMultipliersPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/pricing/complexity");
  const user = await requireArea("pricing");
  const canWrite = userCan(user, "pricing.write");
  const { divisionId, segment, divisionName } = await getActiveScope(
    await searchParams,
  );

  const scope = await getComplexityForScope(divisionId, segment);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complexity multipliers"
        description="Additive complexity adders per scope. Labor-bucket rows adjust hours only; Cabin package-rate rows add dollars to the base plan rate."
      />

      {scope.multipliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No complexity multipliers for the {divisionName} · {segment} scope.
          Seed all scopes with <code className="text-xs">npm run db:seed</code>{" "}
          or{" "}
          <code className="text-xs">
            scripts/run-seed-complexity-multipliers.ts
          </code>
          .
        </p>
      ) : (
        <Panel
          title={`${divisionName} · ${segment}`}
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
