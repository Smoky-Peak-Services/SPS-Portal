import Link from "next/link";
import { listTickets } from "@/features/tickets/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocation } from "@/lib/pii-join";

export default async function TicketsPage() {
  const tickets = await listTickets();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service tickets</h1>
          <p className="text-sm text-slate-500">
            Intake, triage, and field dispatch
          </p>
        </div>
        <Button asChild>
          <Link href="/tickets/new">New ticket</Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
