import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDivisionsForMaterials } from "@/features/materials/actions";
import { DomainForm } from "@/features/materials/components/domain-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewDomainPage() {
  await requireDesktopSurface("/materials/domains/new");
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
        <DomainForm divisions={divisions} />
      </Panel>
    </div>
  );
}
