import Link from "next/link";
import { TicketCreateForm } from "@/features/tickets/components/ticket-create-form";
import { listFieldUsers } from "@/features/jobs/actions";
import { listCustomerOptions } from "@/features/crm/actions";
import { listDivisions } from "@/features/schedule/actions";
import { requireDesktopSurface } from "@/lib/require-desktop";

export default async function NewTicketPage() {
  await requireDesktopSurface("/tickets/new");
  const [divisions, customers, techs] = await Promise.all([
    listDivisions(),
    listCustomerOptions(),
    listFieldUsers(),
  ]);

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
      <TicketCreateForm
        divisions={divisions}
        customers={customers}
        techs={techs}
      />
    </div>
  );
}
