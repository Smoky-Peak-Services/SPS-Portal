import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { listImportExportScopes } from "@/features/materials/io-actions";
import { MaterialsImportExportClient } from "@/features/materials/components/materials-import-export-client";
import { MaterialsAttributeListsIoClient } from "@/features/materials/components/materials-attribute-lists-io-client";

export default async function MaterialsImportExportPage() {
  await requireDesktopSurface("/materials/import-export");
  const user = await requireArea("materials");
  const divisions = await listImportExportScopes();
  const isAdmin = canForceDelete(user);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/materials"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Materials
        </Link>
        <h1 className="text-2xl font-semibold">Import / export</h1>
        <p className="text-sm text-slate-500">
          Excel round-trip for the item catalog (by division + segment) and
          global attribute picklists. Preview, then commit (admin). Missing rows
          are never deleted.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-medium">Item catalog</h2>
        {divisions.length === 0 ? (
          <p className="text-sm text-slate-500">No divisions configured.</p>
        ) : (
          <MaterialsImportExportClient
            divisions={divisions}
            isAdmin={isAdmin}
          />
        )}
      </div>

      <MaterialsAttributeListsIoClient isAdmin={isAdmin} />
    </div>
  );
}
