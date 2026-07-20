import Link from "next/link";
import { listTickets } from "@/features/tickets/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocation } from "@/lib/pii-join";

export default async function TicketsPage() {
  const tickets = await listTickets();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Service tickets</h1>
          <p className="text-sm text-slate-500">
            Intake, triage, and field dispatch
          </p>
        </div>
        <Button asChild className="hidden shrink-0 md:inline-flex">
          <Link href="/tickets/new">New ticket</Link>
        </Button>
      </div>

      <div className="space-y-3 md:hidden">
        {tickets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No tickets yet.
          </p>
        ) : (
          tickets.map((t) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{t.title}</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {t.number}
                  </div>
                </div>
                <Badge className="shrink-0 border-slate-200 bg-slate-50">
                  {t.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {t.customer?.displayName ?? "—"}
              </p>
              <p className="text-xs text-slate-500">
                {formatLocation(t.property)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t.assignedTo?.name ?? "Unassigned"}
              </p>
            </Link>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No tickets yet.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="text-teal-800 hover:underline"
                    >
                      {t.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {formatLocation(t.property)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.customer?.displayName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="border-slate-200 bg-slate-50">
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{t.assignedTo?.name ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
