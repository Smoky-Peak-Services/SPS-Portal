import { company } from "@/config/company";
import { EmptyState } from "@/components/patterns/empty-state";
import { Panel } from "@/components/patterns/panel";

export default async function ClientServiceTicketsPage() {
  const years = company.retention.serviceTicketHistoryYears;
  return (
    <Panel title="Service Tickets">
      <EmptyState
        title="Service tickets coming soon"
        description={`Open and past service ticket history for this customer will appear here when field ops is rebuilt. Service ticket history will auto-purge after ${years} years.`}
      />
    </Panel>
  );
}
