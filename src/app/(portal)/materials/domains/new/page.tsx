import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDivisionsForMaterials } from "@/features/materials/actions";
import { DomainForm } from "@/features/materials/components/domain-form";

export default async function NewDomainPage() {
  await requireDesktopSurface("/materials/domains/new");
  const divisions = await listDivisionsForMaterials();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/domains"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Domains
        </Link>
        <h1 className="text-2xl font-semibold">New domain</h1>
      </div>
      <DomainForm divisions={divisions} />
    </div>
  );
}
