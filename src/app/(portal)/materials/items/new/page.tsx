import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getCategory,
  listCategories,
  listUnits,
} from "@/features/materials/actions";
import { ItemForm } from "@/features/materials/components/item-form";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  await requireDesktopSurface("/materials/items/new");
  const { categoryId } = await searchParams;
  const [categories, units, category] = await Promise.all([
    listCategories(),
    listUnits(),
    categoryId ? getCategory(categoryId) : Promise.resolve(null),
  ]);

  const assignments = category?.assignments ?? [];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/items"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Items
        </Link>
        <h1 className="text-2xl font-semibold">New item</h1>
      </div>
      {categories.length === 0 || units.length === 0 ? (
        <p className="text-sm text-slate-500">
          Need at least one category and seeded units before creating items. Run{" "}
          <code className="text-xs">npm run db:seed</code> if units are missing.
        </p>
      ) : (
        <ItemForm
          categories={categories}
          units={units}
          defaultCategoryId={categoryId}
          assignments={assignments.map((a) => ({
            attributeId: a.attributeId,
            isRequired: a.isRequired,
            attribute: {
              id: a.attribute.id,
              name: a.attribute.name,
              slug: a.attribute.slug,
              inputType: a.attribute.inputType,
              unit: a.attribute.unit,
              options: a.attribute.options,
            },
          }))}
        />
      )}
    </div>
  );
}
