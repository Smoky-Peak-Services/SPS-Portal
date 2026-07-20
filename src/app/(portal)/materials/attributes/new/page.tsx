import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { AttributeForm } from "@/features/materials/components/attribute-form";

export default async function NewAttributePage() {
  await requireDesktopSurface("/materials/attributes/new");

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/materials/attributes"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Attributes
        </Link>
        <h1 className="text-2xl font-semibold">New attribute</h1>
      </div>
      <AttributeForm />
    </div>
  );
}
