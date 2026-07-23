import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { requireArea } from "@/lib/session";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { getCustomerProfile } from "@/features/crm/queries";
import { canArchiveCrm } from "@/features/crm/authz";
import { ArchiveCustomerButton } from "@/features/crm/components/archive-customer-button";
import {
  SectionTabs,
  type SectionTab,
} from "@/components/patterns/section-tabs";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";

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
    { label: "Root Org", href: base },
    { label: "Billing", href: `${base}/billing` },
    { label: "Contacts", href: `${base}/contacts` },
    { label: "Locations", href: `${base}/locations` },
    { label: "Activity", href: `${base}/activity` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.displayName}
        description={`${customer.type} · ${customer.division.name}${
          customer.archivedAt ? " · Archived" : ""
        }${
          customer.billingStatus.complete
            ? " · Billing complete"
            : " · Billing incomplete"
        }`}
        actions={
          <div className="flex gap-2">
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
        }
      />
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
