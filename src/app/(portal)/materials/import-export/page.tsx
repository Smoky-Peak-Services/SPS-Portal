import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { listImportExportScopes } from "@/features/materials/io-actions";
import { MaterialsImportExportClient } from "@/features/materials/components/materials-import-export-client";
import { MaterialsAttributeListsIoClient } from "@/features/materials/components/materials-attribute-lists-io-client";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";

export default async function MaterialsImportExportPage() {
  await requireDesktopSurface("/materials/import-export");
  const user = await requireArea("materials");
  const divisions = await listImportExportScopes();
  const isAdmin = canForceDelete(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import / export"
        description="Excel round-trip for the item catalog (by division + segment) and global attribute picklists. Preview, then commit (admin). Missing rows are never deleted."
      />

      <Panel title="Item catalog">
        {divisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No divisions configured.</p>
        ) : (
          <MaterialsImportExportClient
            divisions={divisions}
            isAdmin={isAdmin}
          />
        )}
      </Panel>

      <Panel title="Attribute lists">
        <MaterialsAttributeListsIoClient isAdmin={isAdmin} />
      </Panel>
    </div>
  );
}
