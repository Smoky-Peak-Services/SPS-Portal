import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listItems } from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { ItemDeleteCell } from "@/features/materials/components/item-delete-cell";
import { MaterialsImportExportClient } from "@/features/materials/components/materials-import-export-client";
import { Button } from "@/components/ui/button";
import { resolveItemTaxClassification } from "@/features/materials/tax";
import { canForceDelete } from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { listImportExportScopes } from "@/features/materials/io-actions";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { Panel } from "@/components/patterns/panel";
import { EmptyState } from "@/components/patterns/empty-state";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/items");
  const user = await requireArea("materials");
  const scope = await getActiveScope(await searchParams);
  const items = await listItems(scope);
  const canIo = userCan(user, "materials.import_export");
  const isAdmin = canForceDelete(user);
  const divisions = canIo ? await listImportExportScopes() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        description={`Catalog line items in ${scope.divisionName} · ${scope.segment}. Tax classification resolves item → category.`}
        actions={
          <Button asChild>
            <Link href="/materials/items/new">New item</Link>
          </Button>
        }
      />
      {canIo && divisions.length > 0 ? (
        <Panel
          title="Catalog Excel"
          description="Includes tax override columns (stripeTaxCodeId, labor install/service). Blank tax cells clear overrides — re-export before import. Item taxProfile stays inherited."
        >
          <MaterialsImportExportClient
            divisions={divisions}
            isAdmin={isAdmin}
            defaultDivisionId={scope.divisionId}
            defaultSegment={scope.segment}
          />
        </Panel>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          title={`No items in the ${scope.divisionName} · ${scope.segment} catalog yet.`}
          description="Create an item under one of this scope's categories, or import a catalog workbook."
          action={
            <Button asChild>
              <Link href="/materials/items/new">New item</Link>
            </Button>
          }
        />
      ) : (
        <DataTableShell>
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
              {items.map((item) => {
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
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </div>
  );
}
