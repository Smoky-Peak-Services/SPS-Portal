import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { listCustomers } from "@/features/crm/queries";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";

export default async function ClientsArchivePage() {
  await requireDesktopSurface("/clients/archive");
  await requireArea("crm");

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Client archive requires the PII database."
      />
    );
  }

  const customers = await listCustomers({ archived: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archived clients"
        description="Restored accounts return to the active Clients list."
        actions={
          <Button asChild variant="outline">
            <Link href="/clients">Active clients</Link>
          </Button>
        }
      />
      {customers.length === 0 ? (
        <EmptyState title="No archived clients" />
      ) : (
        <DataTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Division</th>
                <th className="px-4 py-3">Archived</th>
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
                  </td>
                  <td className="px-4 py-3">{c.type}</td>
                  <td className="px-4 py-3">{c.division.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.archivedAt
                      ? new Date(c.archivedAt).toLocaleDateString()
                      : "—"}
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
