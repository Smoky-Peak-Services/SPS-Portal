import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/features/crm/actions";
import { LocationCreateForm } from "@/features/crm/components/location-create-form";
import { Badge } from "@/components/ui/badge";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clients"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Clients
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{customer.displayName}</h1>
          <Badge className="border-slate-200 bg-slate-50">
            {customer.type}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {customer.division.name} · {customer.mainPhone ?? "—"} ·{" "}
          {customer.generalEmail ?? "—"}
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Service locations
          </h2>
          <LocationCreateForm customerId={customer.id} />
        </div>
        {customer.serviceLocations.length === 0 ? (
          <p className="text-sm text-slate-500">No locations yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {customer.serviceLocations.map((loc) => (
              <li key={loc.id} className="py-3 text-sm">
                <div className="font-medium">{loc.siteName ?? loc.line1}</div>
                <div className="text-slate-600">
                  {loc.line1}
                  {loc.line2 ? `, ${loc.line2}` : ""}, {loc.city}, {loc.region}{" "}
                  {loc.postalCode}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
