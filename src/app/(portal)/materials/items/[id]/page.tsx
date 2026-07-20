import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getItem,
  listCategories,
  listUnits,
} from "@/features/materials/actions";
import { ItemForm } from "@/features/materials/components/item-form";
import { resolveItemTaxClassification } from "@/features/materials/tax";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/items/${id}`);
  const [item, categories, units] = await Promise.all([
    getItem(id),
    listCategories(),
    listUnits(),
  ]);
  if (!item) notFound();

  const tax = resolveItemTaxClassification(item, item.category);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/items"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Items
        </Link>
        <h1 className="text-2xl font-semibold">{item.name}</h1>
        <p className="text-sm text-slate-500">
          Resolved tax: {tax.taxProfile ?? "unclassified"}
          {tax.stripeTaxCode ? ` · ${tax.stripeTaxCode}` : " · no Stripe code"}
          {tax.inheritedFrom ? ` (from ${tax.inheritedFrom})` : ""}
        </p>
      </div>
      <ItemForm
        categories={categories}
        units={units}
        assignments={item.category.assignments.map((a) => ({
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
        initial={{
          id: item.id,
          categoryId: item.categoryId,
          unitId: item.unitId,
          name: item.name,
          laborUnits: item.laborUnits,
          laborUnitNotes: item.laborUnitNotes,
          isConsumable: item.isConsumable,
          baseCost: item.baseCost,
          markupPct: item.markupPct,
          wasteFactorPct: item.wasteFactorPct,
          supplier: item.supplier,
          notes: item.notes,
          isActive: item.isActive,
          taxProfile: item.taxProfile,
          stripeTaxCode: item.stripeTaxCode,
          values: item.values,
        }}
      />
    </div>
  );
}
