import Link from "next/link";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { listCrmDivisions, listLeadBoard } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { LeadsFilterBar } from "@/features/crm/components/leads-filter-bar";
import { LeadStatusSelect } from "@/features/crm/components/lead-status-select";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay } from "@/lib/phone-format";

const COLUMNS = [
  "INQUIRY",
  "SITE_VISIT",
  "ESTIMATE_SENT",
  "APPROVED",
] as const;

const LABELS: Record<(typeof COLUMNS)[number], string> = {
  INQUIRY: "Inquiry",
  SITE_VISIT: "Site visit",
  ESTIMATE_SENT: "Estimate sent",
  APPROVED: "Approved",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; divisionId?: string }>;
}) {
  await requireDesktopSurface("/leads");
  const user = await requireArea("crm");
  const sp = await searchParams;

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Leads require the PII database. Set PII_DATABASE_URL locally or CLIENT_DB_SECRET_ARN in production."
      />
    );
  }

  const [divisions, board] = await Promise.all([
    listCrmDivisions(),
    listLeadBoard({
      q: sp.q,
      divisionId: sp.divisionId,
    }),
  ]);
  const canWrite = canWriteCrm(user);
  const totalOpen = COLUMNS.reduce((n, col) => n + board.counts[col], 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Website and phone inquiries. Promote a lead to a client when you are ready to quote."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/leads/archive">Archive</Link>
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link href="/leads/new">New lead</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <LeadsFilterBar
        divisions={divisions}
        q={sp.q}
        divisionId={sp.divisionId}
      />

      {totalOpen === 0 ? (
        <EmptyState
          title="No open leads"
          description="Website form submissions and manually created leads appear here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = board.columns[col];
            const count = board.counts[col];
            return (
              <div
                key={col}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{LABELS[col]}</span>
                  <span>{count}</span>
                </div>
                <div className="space-y-2">
                  {items.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-md border border-border bg-background p-3"
                    >
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium hover:underline"
                      >
                        {lead.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {lead.orgDivision.name}
                        {lead.phone
                          ? ` · ${formatPhoneDisplay(lead.phone)}`
                          : ""}
                      </p>
                      {lead.company ? (
                        <p className="text-xs text-muted-foreground">
                          {lead.company}
                        </p>
                      ) : null}
                      {canWrite ? (
                        <div className="mt-2">
                          <LeadStatusSelect
                            leadId={lead.id}
                            status={lead.status}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {count > items.length ? (
                    <p className="text-xs text-muted-foreground">
                      Showing {items.length} of {count}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
