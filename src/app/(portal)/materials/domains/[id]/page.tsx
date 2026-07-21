import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getDomain,
  listDivisionsForMaterials,
} from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { DomainForm } from "@/features/materials/components/domain-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function EditDomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/domains/${id}`);
  const [domain, divisions] = await Promise.all([
    getDomain(id),
    listDivisionsForMaterials(),
  ]);
  if (!domain) notFound();

  // Keep the layout scope switcher truthful: viewing a record from another
  // scope re-points the URL scope at the record's own scope.
  const active = await getActiveScope(await searchParams);
  if (
    active.divisionId !== domain.divisionId ||
    active.segment !== domain.segment
  ) {
    redirect(
      `/materials/domains/${id}?divisionId=${encodeURIComponent(domain.divisionId)}&segment=${encodeURIComponent(domain.segment)}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit domain"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/domains">Domains</Link>
          </Button>
        }
      />
      <Panel>
        <DomainForm
          divisions={divisions}
          initial={{
            id: domain.id,
            divisionId: domain.divisionId,
            segment: domain.segment,
            name: domain.name,
            slug: domain.slug,
            description: domain.description,
            sortOrder: domain.sortOrder,
            isActive: domain.isActive,
          }}
        />
      </Panel>
    </div>
  );
}
