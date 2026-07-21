import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { canForceDelete } from "@/features/materials/authz";
import { getAttribute } from "@/features/materials/actions";
import { AttributeForm } from "@/features/materials/components/attribute-form";
import { AttributeDeleteCell } from "@/features/materials/components/attribute-delete-cell";

export default async function AttributeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/attributes/${id}`);
  const user = await requireArea("materials");
  const attribute = await getAttribute(id);
  if (!attribute) notFound();

  const isAdmin = canForceDelete(user);
  const usageCount =
    attribute.assignments.length +
    attribute.options.reduce(
      (n, o) => n + o._count.itemValues + o._count.defaultFor,
      0,
    );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/materials/attributes"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Attributes
          </Link>
          <h1 className="text-2xl font-semibold">{attribute.name}</h1>
        </div>
        <AttributeDeleteCell
          id={attribute.id}
          name={attribute.name}
          usageCount={usageCount}
          isAdmin={isAdmin}
        />
      </div>
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
        }}
      />
    </div>
  );
}
