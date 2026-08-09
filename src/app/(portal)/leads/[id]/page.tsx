import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { getLead } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { LeadStatusSelect } from "@/features/crm/components/lead-status-select";
import { PromoteLeadButton } from "@/features/crm/components/promote-lead-button";
import { LeadNoteForm } from "@/features/crm/components/lead-note-form";
import { DeleteLeadButton } from "@/features/crm/components/delete-lead-button";
import { PageHeader } from "@/components/patterns/page-header";
import { Panel } from "@/components/patterns/panel";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { formatPhoneDisplay } from "@/lib/phone-format";
import { formatInCompanyTz } from "@/lib/datetime";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/leads/${id}`);
  const user = await requireArea("crm");

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Leads require the PII database."
      />
    );
  }

  const lead = await getLead(id);
  if (!lead) notFound();
  const canWrite = canWriteCrm(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        description={`${lead.orgDivision.name} · ${lead.source}${
          lead.phone ? ` · ${formatPhoneDisplay(lead.phone)}` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/leads">Back to pipeline</Link>
            </Button>
            {canWrite ? (
              <DeleteLeadButton leadId={lead.id} leadName={lead.name} />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Details">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{lead.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Company</dt>
              <dd>{lead.company ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Budget</dt>
              <dd>{lead.budget ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Timeline</dt>
              <dd>{lead.timeline ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Form division</dt>
              <dd>{lead.division ?? "—"}</dd>
            </div>
            {lead.customer ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Client</dt>
                <dd>
                  <Link
                    href={`/clients/${lead.customer.id}`}
                    className="text-primary hover:underline"
                  >
                    {lead.customer.displayName}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {lead.message ? (
            <p className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
              {lead.message}
            </p>
          ) : null}

          {canWrite ? (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <LeadStatusSelect leadId={lead.id} status={lead.status} />
              {!lead.customerId ? (
                <PromoteLeadButton leadId={lead.id} />
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Status: {lead.status}
            </p>
          )}
        </Panel>

        <Panel title="Activity">
          {canWrite ? (
            <div className="mb-4">
              <LeadNoteForm leadId={lead.id} />
            </div>
          ) : null}
          {lead.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {lead.activities.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{a.type}</span>
                    <span>
                      {formatInCompanyTz(a.createdAt, "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                  {a.body ? (
                    <p className="mt-1 whitespace-pre-wrap">{a.body}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
