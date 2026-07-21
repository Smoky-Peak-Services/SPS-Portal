import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listDivisionsForMaterials } from "@/features/materials/actions";
import { resolvePageScope } from "@/features/pricing/scope-page";
import { AttributeForm } from "@/features/materials/components/attribute-form";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function NewAttributePage({
  searchParams,
}: {
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  await requireDesktopSurface("/materials/attributes/new");
  await requireArea("materials");
  const params = await searchParams;

  const divisions = await listDivisionsForMaterials();
  const { divisionId, segment } = resolvePageScope({
    divisionId: params.divisionId,
    segment: params.segment,
    divisions,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New attribute"
        description="Attributes are per-scope — pick the division + segment this attribute belongs to."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/attributes">Attributes</Link>
          </Button>
        }
      />
      <Panel>
        <AttributeForm
          divisions={divisions}
          defaultDivisionId={divisionId}
          defaultSegment={segment}
        />
      </Panel>
    </div>
  );
}
