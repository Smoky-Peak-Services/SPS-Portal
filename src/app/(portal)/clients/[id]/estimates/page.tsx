import { company } from "@/config/company";
import { EmptyState } from "@/components/patterns/empty-state";
import { Panel } from "@/components/patterns/panel";

export default async function ClientEstimatesPage() {
  const years = company.retention.estimateHistoryYears;
  return (
    <Panel title="Estimates">
      <EmptyState
        title="Estimates coming soon"
        description={`System-generated estimates for this customer (accepted, price, completion) will appear here when quoting is built. Estimate history will auto-purge after ${years} years.`}
      />
    </Panel>
  );
}
