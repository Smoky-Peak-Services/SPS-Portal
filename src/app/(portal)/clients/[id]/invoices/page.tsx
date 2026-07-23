import { company } from "@/config/company";
import { EmptyState } from "@/components/patterns/empty-state";
import { Panel } from "@/components/patterns/panel";

export default async function ClientInvoicesPage() {
  const years = company.retention.invoiceHistoryYears;
  return (
    <Panel title="Invoices">
      <EmptyState
        title="Invoices coming soon"
        description={`Invoice history for this customer will appear here when billing is built. Invoice history will auto-purge after ${years} years.`}
      />
    </Panel>
  );
}
