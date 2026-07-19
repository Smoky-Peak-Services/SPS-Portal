import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicket } from "@/features/tickets/actions";
import { listFieldUsers } from "@/features/jobs/actions";
import { StatusButtons } from "@/features/jobs/components/status-buttons";
import { AssignForm } from "@/features/schedule/components/assign-form";
import { Badge } from "@/components/ui/badge";
import { formatLocation } from "@/lib/pii-join";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ticket, techs] = await Promise.all([getTicket(id), listFieldUsers()]);
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tickets"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Tickets
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{ticket.title}</h1>
          <Badge className="border-slate-200 bg-slate-50 font-mono">
            {ticket.number}
          </Badge>
          <Badge className="border-teal-200 bg-teal-50 text-teal-900">
            {ticket.status}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {ticket.division.name} ·{" "}
          {ticket.customer?.displayName ?? "No customer"} ·{" "}
          {formatLocation(ticket.property)}
        </p>
      </div>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Status
        </h2>
        <StatusButtons kind="ticket" id={ticket.id} current={ticket.status} />
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Assign
        </h2>
        <AssignForm
          kind="ticket"
          id={ticket.id}
          techs={techs}
          currentUserId={ticket.assignedToId}
        />
      </section>

      {ticket.job ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          Linked job:{" "}
          <Link
            href={`/jobs/${ticket.job.id}`}
            className="text-teal-800 hover:underline"
          >
            {ticket.job.number} — {ticket.job.title}
          </Link>
        </section>
      ) : null}

      {ticket.description ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {ticket.description}
          </p>
        </section>
      ) : null}
    </div>
  );
}
