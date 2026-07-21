import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getCategory,
  listAttributes,
  listDomains,
  listStripeTaxCodes,
} from "@/features/materials/actions";
import { CategoryForm } from "@/features/materials/components/category-form";
import { AssignmentPanel } from "@/features/materials/components/assignment-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/categories/${id}`);
  const [category, domains, attributes, taxCodes] = await Promise.all([
    getCategory(id),
    listDomains(),
    listAttributes({ activeOnly: true }),
    listStripeTaxCodes(),
  ]);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        description={`${category.domain.division.name} / ${category.domain.name}${
          !category.taxReviewed ? " · needs tax review" : ""
        }`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/materials/categories">Categories</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/materials/items/new?categoryId=${category.id}`}>
                New item in category
              </Link>
            </Button>
          </>
        }
      />
      <Panel>
        <CategoryForm
          domains={domains}
          taxCodes={taxCodes}
          initial={{
            id: category.id,
            domainId: category.domainId,
            name: category.name,
            slug: category.slug,
            description: category.description,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            requiresManualPartNumber: category.requiresManualPartNumber,
            stripeTaxCodeId: category.stripeTaxCodeId,
            laborInstallTaxCodeId: category.laborInstallTaxCodeId,
            laborServiceTaxCodeId: category.laborServiceTaxCodeId,
            taxReviewed: category.taxReviewed,
          }}
        />
      </Panel>
      <AssignmentPanel
        categoryId={category.id}
        assignments={category.assignments}
        availableAttributes={attributes}
      />
    </div>
  );
}
