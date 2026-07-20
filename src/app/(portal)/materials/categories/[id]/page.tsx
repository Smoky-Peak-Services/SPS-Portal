import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getCategory,
  listAttributes,
  listDomains,
} from "@/features/materials/actions";
import { CategoryForm } from "@/features/materials/components/category-form";
import { AssignmentPanel } from "@/features/materials/components/assignment-panel";
import { Button } from "@/components/ui/button";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/categories/${id}`);
  const [category, domains, attributes] = await Promise.all([
    getCategory(id),
    listDomains(),
    listAttributes(),
  ]);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/materials/categories"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Categories
          </Link>
          <h1 className="text-2xl font-semibold">{category.name}</h1>
          <p className="text-sm text-slate-500">
            {category.domain.division.name} / {category.domain.name}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/materials/items/new?categoryId=${category.id}`}>
            New item in category
          </Link>
        </Button>
      </div>
      <CategoryForm
        domains={domains}
        initial={{
          id: category.id,
          domainId: category.domainId,
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          requiresManualPartNumber: category.requiresManualPartNumber,
          taxProfile: category.taxProfile,
          stripeTaxCode: category.stripeTaxCode,
        }}
      />
      <AssignmentPanel
        categoryId={category.id}
        assignments={category.assignments}
        availableAttributes={attributes}
      />
    </div>
  );
}
