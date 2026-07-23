import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getCustomerProfile } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { BillingProfileForm } from "@/features/crm/components/billing-profile-form";
import { Panel } from "@/components/patterns/panel";

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireArea("crm");
  const customer = await getCustomerProfile(id);
  if (!customer) notFound();

  return (
    <Panel
      title="Billing profile"
      description="Individual for residential/STR by default; Entity for commercial."
    >
      <BillingProfileForm
        rootOrgId={customer.id}
        billing={customer.billingProfile}
        contacts={customer.contacts}
        canWrite={canWriteCrm(user)}
        missing={customer.billingStatus.missing}
      />
    </Panel>
  );
}
