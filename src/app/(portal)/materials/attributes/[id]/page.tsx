import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { getAttribute } from "@/features/materials/actions";
import { AttributeForm } from "@/features/materials/components/attribute-form";

export default async function AttributeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/attributes/${id}`);
  const attribute = await getAttribute(id);
  if (!attribute) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/attributes"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Attributes
        </Link>
        <h1 className="text-2xl font-semibold">{attribute.name}</h1>
      </div>
      <AttributeForm
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
