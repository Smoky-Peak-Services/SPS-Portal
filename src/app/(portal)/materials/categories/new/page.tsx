import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDomains, listStripeTaxCodes } from "@/features/materials/actions";
import { CategoryForm } from "@/features/materials/components/category-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewCategoryPage() {
  await requireDesktopSurface("/materials/categories/new");
  const [domains, taxCodes] = await Promise.all([
    listDomains(),
    listStripeTaxCodes(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New category"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/categories">Categories</Link>
          </Button>
        }
      />
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a domain first, then add categories.
        </p>
      ) : (
        <Panel>
          <CategoryForm domains={domains} taxCodes={taxCodes} />
        </Panel>
      )}
    </div>
  );
}
