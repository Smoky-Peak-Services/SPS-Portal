import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDomains, listStripeTaxCodes } from "@/features/materials/actions";
import { CategoryForm } from "@/features/materials/components/category-form";

export default async function NewCategoryPage() {
  await requireDesktopSurface("/materials/categories/new");
  const [domains, taxCodes] = await Promise.all([
    listDomains(),
    listStripeTaxCodes(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/categories"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="text-2xl font-semibold">New category</h1>
      </div>
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a domain first, then add categories.
        </p>
      ) : (
        <CategoryForm domains={domains} taxCodes={taxCodes} />
      )}
    </div>
  );
}
