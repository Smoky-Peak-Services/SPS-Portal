import Link from "next/link";
import { listCustomers } from "@/features/crm/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireDesktopSurface } from "@/lib/require-desktop";

export default async function ClientsPage() {
  await requireDesktopSurface("/clients");
  const customers = await listCustomers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-slate-500">
            PII database · identity for jobs &amp; tickets
          </p>
        </div>
        <Button asChild>
          <Link href="/clients/new">New client</Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Division</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Sites</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No clients yet.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-teal-900 hover:underline"
                    >
                      {c.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="border-slate-200 bg-slate-50">
                      {c.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{c.division.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.mainPhone ?? c.generalEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3">{c._count.serviceLocations}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
