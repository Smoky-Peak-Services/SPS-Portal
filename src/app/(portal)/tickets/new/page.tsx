import Link from "next/link";
import { TicketCreateForm } from "@/features/tickets/components/ticket-create-form";
import { listFieldUsers } from "@/features/jobs/actions";
import { listCustomerOptions } from "@/features/crm/actions";
import { listDivisions } from "@/features/schedule/actions";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { isPiiConfigured } from "@/lib/prisma-pii";

export default async function NewTicketPage() {
  await requireDesktopSurface("/tickets/new");
  const [divisions, customers, techs] = await Promise.all([
    listDivisions(),
    listCustomerOptions(),
    listFieldUsers(),
  ]);
  const piiReady = isPiiConfigured();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/tickets"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Tickets
        </Link>
        <h1 className="text-2xl font-semibold">New ticket</h1>
      </div>
      {!piiReady ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Client picker is empty until the PII database is configured. You can
          still create a ticket without linking a client.
        </p>
      ) : null}
      <TicketCreateForm
        divisions={divisions}
        customers={customers}
        techs={techs}
      />
    </div>
  );
}
