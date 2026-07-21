import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { listImportExportScopes } from "@/features/materials/io-actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { MaterialsImportExportClient } from "@/features/materials/components/materials-import-export-client";
import { MaterialsAttributeListsIoClient } from "@/features/materials/components/materials-attribute-lists-io-client";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";

export default async function MaterialsImportExportPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/import-export");
  const user = await requireArea("materials");
  const scope = await getActiveScope(await searchParams);
  const divisions = await listImportExportScopes();
  const isAdmin = canForceDelete(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import / export"
        description="Excel round-trip for the item catalog and attribute picklists, per scope (division + segment). Preview, then commit (admin). Missing rows are never deleted."
      />

      <Panel title="Item catalog">
        {divisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No divisions configured.
          </p>
        ) : (
          <MaterialsImportExportClient
            divisions={divisions}
            isAdmin={isAdmin}
            defaultDivisionId={scope.divisionId}
            defaultSegment={scope.segment}
          />
        )}
      </Panel>

      <Panel title="Attribute lists">
        <MaterialsAttributeListsIoClient
          isAdmin={isAdmin}
          divisions={divisions}
          defaultDivisionId={scope.divisionId}
          defaultSegment={scope.segment}
        />
      </Panel>
    </div>
  );
}
