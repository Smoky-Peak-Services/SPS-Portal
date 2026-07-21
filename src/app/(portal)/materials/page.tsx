import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listMaterialCounts } from "@/features/materials/actions";
import { PageHeader } from "@/components/patterns/page-header";
import { MetricCard } from "@/components/patterns/metric-card";
import { Button } from "@/components/ui/button";
import { userCan } from "@/config/permissions";

export default async function MaterialsHubPage() {
  await requireDesktopSurface("/materials");
  const user = await requireArea("materials");
  const counts = await listMaterialCounts();
  const canIo = userCan(user, "materials.import_export");

  const cards = [
    { href: "/materials/domains", label: "Domains", count: counts.domains },
    {
      href: "/materials/categories",
      label: "Categories",
      count: counts.categories,
    },
    {
      href: "/materials/attributes",
      label: "Attributes",
      count: counts.attributes,
    },
    { href: "/materials/items", label: "Items", count: counts.items },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials catalog"
        description={`Back-office taxonomy for quoting. Units seeded: ${counts.units}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canIo ? (
              <Button asChild variant="outline">
                <a href="/api/materials/export-everything">Export everything</a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/materials/import-export">Import / export</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <MetricCard
              label={c.label}
              value={String(c.count)}
              className="h-full hover:border-primary/40"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
