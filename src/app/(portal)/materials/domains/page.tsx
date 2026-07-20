import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { listDomains } from "@/features/materials/actions";
import { Button } from "@/components/ui/button";

export default async function DomainsPage() {
  await requireDesktopSurface("/materials/domains");
  const domains = await listDomains();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/materials"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Materials
          </Link>
          <h1 className="text-2xl font-semibold">Domains</h1>
        </div>
        <Button asChild>
          <Link href="/materials/domains/new">New domain</Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Division</th>
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Categories</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No domains yet.
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/materials/domains/${d.id}`}
                      className="font-medium text-teal-900 hover:underline"
                    >
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.division.name}</td>
                  <td className="px-4 py-3">{d.segment}</td>
                  <td className="px-4 py-3">{d._count.categories}</td>
                  <td className="px-4 py-3">
                    {d.isActive ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
