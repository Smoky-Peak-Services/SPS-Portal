import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDivisionsForMaterials } from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { DomainForm } from "@/features/materials/components/domain-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewDomainPage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/domains/new");
  const scope = await getActiveScope(await searchParams);
  const divisions = await listDivisionsForMaterials();

  return (
    <div className="space-y-6">
      <PageHeader
        title="New domain"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/domains">Domains</Link>
          </Button>
        }
      />
      <Panel>
        <DomainForm
          divisions={divisions}
          defaultDivisionId={scope.divisionId}
          defaultSegment={scope.segment}
        />
      </Panel>
    </div>
  );
}
