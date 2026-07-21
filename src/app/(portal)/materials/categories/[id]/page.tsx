import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getCategory,
  listAttributes,
  listDomains,
  listStripeTaxCodes,
} from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { CategoryForm } from "@/features/materials/components/category-form";
import { AssignmentPanel } from "@/features/materials/components/assignment-panel";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/categories/${id}`);
  const [category, taxCodes] = await Promise.all([
    getCategory(id),
    listStripeTaxCodes(),
  ]);
  if (!category) notFound();

  const recordScope = {
    divisionId: category.domain.divisionId,
    segment: category.domain.segment,
  };

  // Keep the layout scope switcher truthful: viewing a record from another
  // scope re-points the URL scope at the record's own scope.
  const active = await getActiveScope(await searchParams);
  if (
    active.divisionId !== recordScope.divisionId ||
    active.segment !== recordScope.segment
  ) {
    redirect(
      `/materials/categories/${id}?divisionId=${encodeURIComponent(recordScope.divisionId)}&segment=${encodeURIComponent(recordScope.segment)}`,
    );
  }

  // Domain picker and assignable attributes stay within the category's scope.
  const [domains, attributes] = await Promise.all([
    listDomains(recordScope),
    listAttributes({ ...recordScope, activeOnly: true }),
  ]);

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
              <Link
                href={`/materials/items/new?categoryId=${category.id}&divisionId=${encodeURIComponent(recordScope.divisionId)}&segment=${encodeURIComponent(recordScope.segment)}`}
              >
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
