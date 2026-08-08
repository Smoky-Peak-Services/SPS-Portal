import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { listCrmDivisions, listLeads } from "@/features/crm/queries";
import { LeadsFilterBar } from "@/features/crm/components/leads-filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTableShell } from "@/components/patterns/data-table-shell";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay } from "@/lib/phone-format";

export default async function LeadsArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; divisionId?: string }>;
}) {
  await requireDesktopSurface("/leads/archive");
  await requireArea("crm");
  const sp = await searchParams;

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Leads require the PII database."
      />
    );
  }

  const [divisions, leads] = await Promise.all([
    listCrmDivisions(),
    listLeads({
      q: sp.q,
      divisionId: sp.divisionId,
      scope: "archive",
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead archive"
        description="Won, lost, and disqualified leads."
        actions={
          <Button asChild variant="outline">
            <Link href="/leads">Back to pipeline</Link>
          </Button>
        }
      />

      <LeadsFilterBar
        divisions={divisions}
        q={sp.q}
        divisionId={sp.divisionId}
      />

      {leads.length === 0 ? (
        <EmptyState
          title="No archived leads"
          description="Closed leads will appear here."
        />
      ) : (
        <DataTableShell>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Division</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Client</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium hover:underline"
                    >
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{lead.status}</td>
                  <td className="px-3 py-2">{lead.orgDivision.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {lead.phone ? formatPhoneDisplay(lead.phone) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {lead.customer ? (
                      <Link
                        href={`/clients/${lead.customer.id}`}
                        className="hover:underline"
                      >
                        {lead.customer.displayName}
                      </Link>
                    ) : (
                      "—"
                    )}
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
