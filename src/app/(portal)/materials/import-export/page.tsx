import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listImportExportScopes } from "@/features/materials/io-actions";
import { MaterialsImportExportClient } from "@/features/materials/components/materials-import-export-client";

export default async function MaterialsImportExportPage() {
  await requireDesktopSurface("/materials/import-export");
  const user = await requireArea("materials");
  const divisions = await listImportExportScopes();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Materials
        </Link>
        <h1 className="text-2xl font-semibold">Import / export</h1>
        <p className="text-sm text-slate-500">
          Excel round-trip for a division + segment scope. Preview, then commit
          (admin). Missing catalog rows are never deleted.
        </p>
      </div>
      {divisions.length === 0 ? (
        <p className="text-sm text-slate-500">No divisions configured.</p>
      ) : (
        <MaterialsImportExportClient
          divisions={divisions}
          isAdmin={user.role === "admin"}
        />
      )}
    </div>
  );
}
