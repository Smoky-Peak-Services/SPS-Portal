import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getCategory,
  listCategories,
  listStripeTaxCodes,
  listUnits,
} from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { ItemForm } from "@/features/materials/components/item-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string;
    divisionId?: string;
    segment?: string;
  }>;
}) {
  await requireDesktopSurface("/materials/items/new");
  const params = await searchParams;
  const { categoryId } = params;
  const scope = await getActiveScope(params);
  // Category picker only offers the active scope's categories.
  const [categories, units, taxCodes, category] = await Promise.all([
    listCategories(scope),
    listUnits(),
    listStripeTaxCodes(),
    categoryId ? getCategory(categoryId) : Promise.resolve(null),
  ]);

  const assignments = category?.assignments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New item"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/items">Items</Link>
          </Button>
        }
      />
      {categories.length === 0 || units.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Need at least one category and seeded units before creating items. Run{" "}
          <code className="text-xs">npm run db:seed</code> if units are missing.
        </p>
      ) : (
        <Panel>
          <ItemForm
            categories={categories}
            units={units}
            taxCodes={taxCodes}
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
        </Panel>
      )}
    </div>
  );
}
