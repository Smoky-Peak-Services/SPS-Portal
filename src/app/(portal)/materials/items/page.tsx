import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listItems } from "@/features/materials/actions";
import { ItemDeleteCell } from "@/features/materials/components/item-delete-cell";
import { Button } from "@/components/ui/button";
import { resolveItemTaxClassification } from "@/features/materials/tax";

export default async function ItemsPage() {
  await requireDesktopSurface("/materials/items");
  await requireArea("materials");
  const items = await listItems();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/materials"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Materials
          </Link>
          <h1 className="text-2xl font-semibold">Items</h1>
        </div>
        <Button asChild>
          <Link href="/materials/items/new">New item</Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
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
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
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
                        className="font-medium text-teal-900 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {item.category.domain.division.name} /{" "}
                      {item.category.name}
                    </td>
                    <td className="px-4 py-3">{item.unit.code}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {tax.taxProfile ?? "—"}
                      {tax.stripeTaxCode ? ` · ${tax.stripeTaxCode}` : ""}
                      {tax.inheritedFrom === "category" ? (
                        <span className="ml-1 text-xs text-slate-400">
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
