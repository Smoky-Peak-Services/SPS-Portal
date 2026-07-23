import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getCustomerProfile, listCrmDivisions } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { RootOrgForm } from "@/features/crm/components/root-org-form";
import { Panel } from "@/components/patterns/panel";

export default async function ClientRootOrgPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireArea("crm");
  const [customer, divisions] = await Promise.all([
    getCustomerProfile(id),
    listCrmDivisions(),
  ]);
  if (!customer) notFound();

  return (
    <Panel
      title="Root org"
      description="Account-level identity. Customer type is a CRM label, not a catalog scope."
    >
      <RootOrgForm
        customer={customer}
        divisions={divisions}
        canWrite={canWriteCrm(user)}
      />
    </Panel>
  );
}
