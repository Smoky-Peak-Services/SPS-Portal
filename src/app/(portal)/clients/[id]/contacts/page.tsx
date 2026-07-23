import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getCustomerProfile } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { ContactsPanel } from "@/features/crm/components/contacts-panel";
import { Panel } from "@/components/patterns/panel";

export default async function ClientContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireArea("crm");
  const customer = await getCustomerProfile(id);
  if (!customer) notFound();

  return (
    <Panel title="Contacts" description="People under this account.">
      <ContactsPanel
        customerId={customer.id}
        contacts={customer.contacts}
        canWrite={canWriteCrm(user)}
      />
    </Panel>
  );
}
