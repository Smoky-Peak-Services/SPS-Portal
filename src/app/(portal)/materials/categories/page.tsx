import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listCategories } from "@/features/materials/actions";
import { CategoryDeleteCell } from "@/features/materials/components/category-delete-cell";
import { CategoryTaxIoToolbar } from "@/features/materials/components/category-tax-io-toolbar";
import { MarkTaxReviewedButton } from "@/features/materials/components/mark-tax-reviewed-button";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { userCan } from "@/config/permissions";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ taxReview?: string }>;
}) {
  await requireDesktopSurface("/materials/categories");
  const user = await requireArea("materials");
  const { taxReview } = await searchParams;
  const needsTaxReview = taxReview === "1";
  const categories = await listCategories(undefined, { needsTaxReview });
  const isAdmin = canForceDelete(user);
  const canIo = userCan(user, "materials.import_export");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description={
          needsTaxReview
            ? "Showing categories that still need tax review."
            : "All categories."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={
                  needsTaxReview
                    ? "/materials/categories"
                    : "/materials/categories?taxReview=1"
                }
              >
                {needsTaxReview ? "Show all" : "Needs tax review"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/materials/categories/new">New category</Link>
            </Button>
          </div>
        }
      />
      {canIo ? <CategoryTaxIoToolbar isAdmin={isAdmin} /> : null}
      <DataTableShell>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Attrs</th>
              <th className="px-4 py-3 text-right">Tax review</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {needsTaxReview
                    ? "No categories awaiting tax review."
                    : "No categories yet."}
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/materials/categories/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.requiresManualPartNumber ? (
                      <span className="ml-2 text-xs text-amber-700">
                        part #
                      </span>
                    ) : null}
                    {c.laborInstallTaxCodeId || c.laborServiceTaxCodeId ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        labor override
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {c.domain.division.name} / {c.domain.name}
                  </td>
                  <td className="px-4 py-3">
                    {c.taxProfile}
                    {c.stripeTaxCode ? ` · ${c.stripeTaxCode.id}` : ""}
                    {!c.taxReviewed ? (
                      <span className="ml-1 text-xs text-amber-700">
                        unreviewed
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{c._count.items}</td>
                  <td className="px-4 py-3">{c._count.assignments}</td>
                  <td className="px-4 py-3">
                    <MarkTaxReviewedButton
                      id={c.id}
                      taxReviewed={c.taxReviewed}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <CategoryDeleteCell
                        id={c.id}
                        name={c.name}
                        itemCount={c._count.items}
                        isAdmin={isAdmin}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
