import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { getAttribute } from "@/features/materials/actions";
import { getActiveScope } from "@/features/scope/get-active-scope";
import { AttributeForm } from "@/features/materials/components/attribute-form";
import { AttributeDeleteCell } from "@/features/materials/components/attribute-delete-cell";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { Button } from "@/components/ui/button";

export default async function AttributeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ divisionId?: string; segment?: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/attributes/${id}`);
  const user = await requireArea("materials");
  const attribute = await getAttribute(id);
  if (!attribute) notFound();

  // Keep the layout scope switcher truthful: viewing a record from another
  // scope re-points the URL scope at the record's own scope.
  const active = await getActiveScope(await searchParams);
  if (
    active.divisionId !== attribute.divisionId ||
    active.segment !== attribute.segment
  ) {
    redirect(
      `/materials/attributes/${id}?divisionId=${encodeURIComponent(attribute.divisionId)}&segment=${encodeURIComponent(attribute.segment)}`,
    );
  }

  const isAdmin = canForceDelete(user);
  const usageCount =
    attribute.assignments.length +
    attribute.options.reduce(
      (n, o) => n + o._count.itemValues + o._count.defaultFor,
      0,
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={attribute.name}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/materials/attributes">Attributes</Link>
            </Button>
            <AttributeDeleteCell
              id={attribute.id}
              name={attribute.name}
              usageCount={usageCount}
              isAdmin={isAdmin}
            />
          </>
        }
      />
      <Panel>
        <AttributeForm
          canForceDelete={isAdmin}
          initial={{
            id: attribute.id,
            name: attribute.name,
            slug: attribute.slug,
            inputType: attribute.inputType,
            unit: attribute.unit,
            isActive: attribute.isActive,
            options: attribute.options,
            divisionName: attribute.division.name,
            segment: attribute.segment,
          }}
        />
      </Panel>
    </div>
  );
}
