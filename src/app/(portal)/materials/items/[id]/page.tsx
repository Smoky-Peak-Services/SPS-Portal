import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getItem,
  listCategories,
  listStripeTaxCodes,
  listUnits,
} from "@/features/materials/actions";
import { ItemForm } from "@/features/materials/components/item-form";
import { resolveItemTaxClassification } from "@/features/materials/tax";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/items/${id}`);
  const [item, categories, units, taxCodes] = await Promise.all([
    getItem(id),
    listCategories(),
    listUnits(),
    listStripeTaxCodes(),
  ]);
  if (!item) notFound();

  const tax = resolveItemTaxClassification(item, item.category);

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.name}
        description={`Resolved tax: ${tax.taxProfile ?? "unclassified"}${
          tax.stripeTaxCodeId
            ? ` · ${tax.stripeTaxCodeId}`
            : " · no Stripe code"
        }${tax.inheritedFrom ? ` (from ${tax.inheritedFrom})` : ""}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/items">Items</Link>
          </Button>
        }
      />
      <Panel>
        <ItemForm
          categories={categories}
          units={units}
          taxCodes={taxCodes}
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
            stripeTaxCodeId: item.stripeTaxCodeId,
            laborInstallTaxCodeId: item.laborInstallTaxCodeId,
            laborServiceTaxCodeId: item.laborServiceTaxCodeId,
            values: item.values,
          }}
        />
      </Panel>
    </div>
  );
}
