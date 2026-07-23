import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { company } from "@/config/company";
import { getCustomerProfile } from "@/features/crm/queries";
import { canArchiveCrm } from "@/features/crm/authz";
import { ArchiveCustomerButton } from "@/features/crm/components/archive-customer-button";
import {
  SectionTabs,
  type SectionTab,
} from "@/components/patterns/section-tabs";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/patterns/panel";

export default async function ClientProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireDesktopSurface(`/clients/${id}`);
  const user = await requireArea("crm");

  if (!isPiiConfigured()) {
    return (
      <EmptyState
        title="PII database not configured"
        description="Client profiles require the PII database."
      />
    );
  }

  const customer = await getCustomerProfile(id);
  if (!customer) notFound();

  const base = `/clients/${id}`;
  const tabs: SectionTab[] = [
    { label: "Client Profile", href: base },
    { label: "Client Contacts", href: `${base}/contacts` },
    { label: "Billing information", href: `${base}/billing` },
    { label: "Service Locations", href: `${base}/locations` },
    { label: "Estimates", href: `${base}/estimates` },
    { label: "Service Tickets", href: `${base}/service-tickets` },
    { label: "Invoices", href: `${base}/invoices` },
    { label: "Notes", href: `${base}/notes` },
  ];

  const updatedAt = DateTime.fromJSDate(customer.updatedAt)
    .setZone(company.timezone)
    .toFormat("d LLL yyyy 'at' h:mm a");

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {customer.displayName}
              </h1>
              {customer.archivedAt ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Archived
                </span>
              ) : null}
              <span
                className={
                  customer.billingStatus.complete
                    ? "rounded-md bg-teal-500/15 px-2 py-0.5 text-xs font-medium text-teal-300"
                    : "rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200"
                }
              >
                {customer.billingStatus.complete
                  ? "Billing complete"
                  : "Billing incomplete"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {customer.type} · {customer.division.name}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {customer.mainPhone ? (
                <a
                  href={`tel:${customer.mainPhone}`}
                  className="text-primary hover:underline"
                >
                  {customer.mainPhone}
                </a>
              ) : (
                <span className="text-muted-foreground">No phone</span>
              )}
              {customer.generalEmail ? (
                <a
                  href={`mailto:${customer.generalEmail}`}
                  className="text-primary hover:underline"
                >
                  {customer.generalEmail}
                </a>
              ) : (
                <span className="text-muted-foreground">No email</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated on {updatedAt}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/clients">All clients</Link>
            </Button>
            {canArchiveCrm(user) ? (
              <ArchiveCustomerButton
                customerId={customer.id}
                archived={!!customer.archivedAt}
              />
            ) : null}
          </div>
        </div>
      </Panel>

      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
