import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listItems } from "@/features/materials/actions";
import { ItemDeleteCell } from "@/features/materials/components/item-delete-cell";
import { MaterialsImportExportClient } from "@/features/materials/components/materials-import-export-client";
import { Button } from "@/components/ui/button";
import { resolveItemTaxClassification } from "@/features/materials/tax";
import { canForceDelete } from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { listImportExportScopes } from "@/features/materials/io-actions";

export default async function ItemsPage() {
  await requireDesktopSurface("/materials/items");
  const user = await requireArea("materials");
  const items = await listItems();
  const canIo = userCan(user, "materials.import_export");
  const isAdmin = canForceDelete(user);
  const divisions = canIo ? await listImportExportScopes() : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/materials"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Materials
          </Link>
          <h1 className="text-2xl font-semibold">Items</h1>
        </div>
        <Button asChild>
          <Link href="/materials/items/new">New item</Link>
        </Button>
      </div>
      {canIo && divisions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Catalog Excel includes tax override columns (
            <code className="text-xs">stripeTaxCodeId</code>, labor install/service).
            Blank tax cells clear overrides — re-export before import. Item taxProfile
            stays inherited (not in the sheet).
          </p>
          <MaterialsImportExportClient
            divisions={divisions}
            isAdmin={isAdmin}
          />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Tax (resolved)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const tax = resolveItemTaxClassification(item, item.category);
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/materials/items/${item.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.laborInstallTaxCodeId ||
                      item.laborServiceTaxCodeId ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          labor override
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {item.category.domain.division.name} /{" "}
                      {item.category.name}
                    </td>
                    <td className="px-4 py-3">{item.unit.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tax.taxProfile ?? "—"}
                      {tax.stripeTaxCodeId ? ` · ${tax.stripeTaxCodeId}` : ""}
                      {tax.inheritedFrom === "category" ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (category)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <ItemDeleteCell id={item.id} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
