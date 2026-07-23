import { notFound } from "next/navigation";
import { requireArea } from "@/lib/session";
import { getCustomerProfile } from "@/features/crm/queries";
import { canWriteCrm } from "@/features/crm/authz";
import { LocationsPanel } from "@/features/crm/components/locations-panel";
import type { ServiceLine } from "@/features/crm/service-location";
import { Panel } from "@/components/patterns/panel";

export default async function ClientLocationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireArea("crm");
  const customer = await getCustomerProfile(id);
  if (!customer) notFound();

  const showCabinFields =
    customer.division.slug === "cabin-services" || customer.type === "STR";

  return (
    <Panel
      title="Service Locations"
      description="Root site or multiple job sites under one profile. Commercial locations are Integrated Systems only."
    >
      <LocationsPanel
        customerId={customer.id}
        locations={customer.serviceLocations.map((loc) => ({
          ...loc,
          serviceLines: loc.serviceLines as ServiceLine[],
        }))}
        canWrite={canWriteCrm(user)}
        showCabinFields={showCabinFields}
      />
    </Panel>
  );
}
