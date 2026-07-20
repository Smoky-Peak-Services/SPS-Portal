import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { listMaterialCounts } from "@/features/materials/actions";

export default async function MaterialsHubPage() {
  await requireDesktopSurface("/materials");
  await requireArea("materials");
  const counts = await listMaterialCounts();

  const cards = [
    { href: "/materials/domains", label: "Domains", count: counts.domains },
    {
      href: "/materials/categories",
      label: "Categories",
      count: counts.categories,
    },
    {
      href: "/materials/attributes",
      label: "Attributes",
      count: counts.attributes,
    },
    { href: "/materials/items", label: "Items", count: counts.items },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Materials catalog</h1>
        <p className="text-sm text-slate-500">
          Back-office taxonomy for quoting. Units seeded: {counts.units}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300 hover:bg-teal-50/40"
          >
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.count}</div>
          </Link>
        ))}
      </div>
      <div>
        <Link
          href="/materials/import-export"
          className="text-sm font-medium text-teal-800 hover:underline"
        >
          Import / export Excel catalog →
        </Link>
      </div>
    </div>
  );
}
