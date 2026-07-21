import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDomains, listStripeTaxCodes } from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { CategoryForm } from "@/features/materials/components/category-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/categories/new");
  const scope = await getActiveScope(await searchParams);
  // Domain picker only offers the active scope's domains.
  const [domains, taxCodes] = await Promise.all([
    listDomains(scope),
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
          No domains in the {scope.divisionName} · {scope.segment} catalog yet.
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
