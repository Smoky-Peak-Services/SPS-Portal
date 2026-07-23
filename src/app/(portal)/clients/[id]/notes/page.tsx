import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getCustomerProfile } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { ActivityPanel } from "@/features/crm/components/activity-panel";
import { Panel } from "@/components/patterns/panel";

export default async function ClientNotesPage({
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
      title="Notes"
      description="Internal comments only: special instructions, warnings, previous issues. Not customer-facing."
    >
      <ActivityPanel
        customerId={customer.id}
        activities={customer.activities}
        locations={customer.serviceLocations}
        canWrite={canWriteCrm(user)}
      />
    </Panel>
  );
}
