import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import {
  getDomain,
  listDivisionsForMaterials,
} from "@/features/materials/actions";
import { DomainForm } from "@/features/materials/components/domain-form";

export default async function EditDomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/materials/domains/${id}`);
  const [domain, divisions] = await Promise.all([
    getDomain(id),
    listDivisionsForMaterials(),
  ]);
  if (!domain) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/domains"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Domains
        </Link>
        <h1 className="text-2xl font-semibold">Edit domain</h1>
      </div>
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
    </div>
  );
}
