import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { listCrmDivisions, listCustomers } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { isBillingComplete } from "@/features/crm/billing";
import { ClientsFilterBar } from "@/features/crm/components/clients-filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    divisionId?: string;
    type?: string;
  }>;
}) {
  await requireDesktopSurface("/clients");
  const user = await requireArea("crm");
  const sp = await searchParams;
  const type =
    sp.type === "RESIDENTIAL" ||
    sp.type === "COMMERCIAL" ||
    sp.type === "STR"
      ? sp.type
      : undefined;

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Client CRM requires the PII database. Set PII_DATABASE_URL locally or CLIENT_DB_SECRET_ARN in production."
      />
    );
  }

  const [divisions, customers] = await Promise.all([
    listCrmDivisions(),
    listCustomers({
      q: sp.q,
      divisionId: sp.divisionId,
      type,
      archived: false,
    }),
  ]);
  const canWrite = canWriteCrm(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Customer accounts (root org → contacts → billing → service locations)."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/clients/archive">Archive</Link>
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link href="/clients/new">New client</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <ClientsFilterBar
        divisions={divisions}
        q={sp.q}
        divisionId={sp.divisionId}
        type={sp.type}
      />

      {customers.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Create a residential or commercial account to start the CRM profile."
          action={
            canWrite ? (
              <Button asChild>
                <Link href="/clients/new">New client</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3">Sites</th>
                <th className="px-4 py-3">Billing</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.displayName}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {c.mainPhone || c.generalEmail || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.type}</td>
                  <td className="px-4 py-3">{c.division.name}</td>
                  <td className="px-4 py-3">{c._count.contacts}</td>
                  <td className="px-4 py-3">{c._count.serviceLocations}</td>
                  <td className="px-4 py-3">
                    {c.billingProfile && isBillingComplete(c.billingProfile)
                      ? "Complete"
                      : "Incomplete"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}
    </div>
  );
}
