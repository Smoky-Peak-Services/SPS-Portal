import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { userCan } from "@/config/permissions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { listEquipmentForDivision } from "@/features/equipment/actions";
import { EquipmentTable } from "@/features/equipment/components/equipment-table";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";

/**
 * Equipment & Tools are division-scoped picklist placeholders (prompt 18):
 * IS-Commercial and IS-Residential share one list; Cabin has its own.
 * Cost is entered later on quotes/tickets — not stored on the catalog row.
 */
export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/equipment");
  const user = await requireArea("materials");
  const canWrite = userCan(user, "materials.catalog.write");
  const canDelete = userCan(user, "materials.delete");
  const scope = await getActiveScope(await searchParams);

  const items = await listEquipmentForDivision(scope.divisionId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment & Tools"
        description={`Picklist of specialized equipment and tools for ${scope.divisionName} (shared across segments). Cost is entered on the quote or ticket; sell = cost × 1.15 at use time.`}
      />

      <Panel
        title={`${scope.divisionName} · all segments`}
        description={
          items.length === 0
            ? "Empty list — add equipment or tools for this division"
            : `${items.length} placeholders · pricing at use time`
        }
      >
        <EquipmentTable
          key={scope.divisionId}
          items={items}
          divisionId={scope.divisionId}
          divisionName={scope.divisionName}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      </Panel>
    </div>
  );
}
