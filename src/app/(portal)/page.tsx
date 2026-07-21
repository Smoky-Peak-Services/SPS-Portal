import Link from "next/link";
import { requireUser } from "@/lib/session";
import { company } from "@/config/company";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/patterns/page-header";
import { MetricCard } from "@/components/patterns/metric-card";
import { Panel } from "@/components/patterns/panel";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { userCan } from "@/config/permissions";

export default async function DashboardPage() {
  const user = await requireUser();

  const canMaterials = userCan(user, "materials.access");
  const [categoryCount, itemCount, needsTaxReview] = canMaterials
    ? await Promise.all([
        prisma.materialCategory.count({ where: { isActive: true } }),
        prisma.materialItem.count({ where: { isActive: true } }),
        prisma.materialCategory.count({ where: { taxReviewed: false } }),
      ])
    : [0, 0, 0];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${greeting}, ${user.name.split(" ")[0] ?? user.name}. Here's your ${company.shortName} operations hub.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active categories"
          value={canMaterials ? String(categoryCount) : "—"}
          hint={canMaterials ? "Materials catalog" : "No materials access"}
        />
        <MetricCard
          label="Active items"
          value={canMaterials ? String(itemCount) : "—"}
          hint="Catalog SKUs"
        />
        <MetricCard
          label="Tax review queue"
          value={canMaterials ? String(needsTaxReview) : "—"}
          hint="Categories not yet reviewed"
          deltaTone={needsTaxReview > 0 ? "negative" : "positive"}
          delta={
            canMaterials && needsTaxReview > 0 ? "Needs attention" : undefined
          }
        />
        <MetricCard
          label="Role"
          value={user.role.replaceAll("_", " ")}
          hint={user.email}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Quick links"
          description="Jump into the areas that are live today."
        >
          <div className="flex flex-wrap gap-2">
            {canMaterials ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/materials">Materials</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/materials/categories?taxReview=1">
                    Tax review
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/materials/import-export">Catalog I/O</Link>
                </Button>
              </>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/account">Account</Link>
            </Button>
          </div>
        </Panel>

        <EmptyState
          title="More modules coming"
          description="Quoting, field service, and CRM will plug into this shell using the same cards, tables, and sidebar patterns."
        />
      </div>
    </div>
  );
}
