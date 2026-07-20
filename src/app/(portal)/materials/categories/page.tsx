import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listCategories } from "@/features/materials/actions";
import { CategoryDeleteCell } from "@/features/materials/components/category-delete-cell";
import { MarkTaxReviewedButton } from "@/features/materials/components/mark-tax-reviewed-button";
import { Button } from "@/components/ui/button";
import { requireArea } from "@/lib/session";

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
  const isAdmin = user.role === "admin";

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
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-slate-500">
            {needsTaxReview
              ? "Showing categories that still need tax review."
              : "All categories."}{" "}
            <Link
              href={
                needsTaxReview
                  ? "/materials/categories"
                  : "/materials/categories?taxReview=1"
              }
              className="text-teal-800 hover:underline"
            >
              {needsTaxReview ? "Show all" : "Needs tax review"}
            </Link>
          </p>
        </div>
        <Button asChild>
          <Link href="/materials/categories/new">New category</Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
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
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
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
                      className="font-medium text-teal-900 hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.requiresManualPartNumber ? (
                      <span className="ml-2 text-xs text-amber-700">
                        part #
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {c.domain.division.name} / {c.domain.name}
                  </td>
                  <td className="px-4 py-3">
                    {c.taxProfile}
                    {c.stripeTaxCode
                      ? ` · ${c.stripeTaxCode.id}`
                      : ""}
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
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
