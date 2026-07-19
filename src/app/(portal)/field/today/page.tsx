import Link from "next/link";
import { getMyDay } from "@/features/schedule/actions";
import { Badge } from "@/components/ui/badge";
import { formatLocation } from "@/lib/pii-join";
import { requireUser } from "@/lib/session";

export default async function MyDayPage() {
  const user = await requireUser();
  const { jobs, tickets } = await getMyDay();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Day</h1>
        <p className="text-sm text-slate-500">Assigned work for {user.name}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No jobs on your plate right now.
          </p>
        ) : (
          jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{job.title}</span>
                <Badge className="border-slate-200 bg-slate-50 font-mono text-[10px]">
                  {job.number}
                </Badge>
                <Badge className="border-teal-200 bg-teal-50 text-teal-900">
                  {job.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {job.customer?.displayName ?? "—"} ·{" "}
                {formatLocation(job.property)}
              </p>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tickets
        </h2>
        {tickets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No open tickets assigned to you.
          </p>
        ) : (
          tickets.map((t) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-300"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.title}</span>
                <Badge className="border-slate-200 bg-slate-50 font-mono text-[10px]">
                  {t.number}
                </Badge>
                <Badge className="border-teal-200 bg-teal-50 text-teal-900">
                  {t.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {t.customer?.displayName ?? "—"}
              </p>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
