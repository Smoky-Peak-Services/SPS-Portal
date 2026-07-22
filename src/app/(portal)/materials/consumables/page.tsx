import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import {
  getBlendedInstallRateForScope,
  listConsumablesForDivision,
} from "@/features/consumables/actions";
import { ConsumablesTable } from "@/features/consumables/components/consumables-table";
import { DEFAULT_MARKUP_BY_DIVISION_SLUG } from "@/features/consumables/schemas";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";

/**
 * Consumables are division-scoped (prompt 17): IS-Commercial and IS-Residential
 * share one list; Cabin has its own. The active scope's segment only affects
 * the derived blended labor rate shown as a reference.
 */
export default async function ConsumablesPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/consumables");
  const user = await requireArea("materials");
  const canWrite = userCan(user, "materials.catalog.write");
  const canDelete = userCan(user, "materials.delete");
  const scope = await getActiveScope(await searchParams);

  const [items, blendedLaborRate] = await Promise.all([
    listConsumablesForDivision(scope.divisionId),
    getBlendedInstallRateForScope(scope.divisionId, scope.segment),
  ]);

  const defaultMarkup =
    DEFAULT_MARKUP_BY_DIVISION_SLUG[scope.divisionSlug] ?? 0.5;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consumables"
        description={`Shop supplies for ${scope.divisionName} (shared across segments). Pricing lives here — not on materials. Labor rate/cost follow the active scope's blended INSTALL rate (${scope.segment}).`}
      />

      <Panel
        title={`${scope.divisionName} · all segments`}
        description={
          items.length === 0
            ? "Empty list — add items or seed from the CSV fixtures"
            : `${items.length} items · active scope ${scope.segment} for labor rate`
        }
      >
        <ConsumablesTable
          key={scope.divisionId}
          items={items}
          divisionId={scope.divisionId}
          divisionName={scope.divisionName}
          defaultMarkupPct={defaultMarkup}
          blendedLaborRate={blendedLaborRate}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      </Panel>
    </div>
  );
}
