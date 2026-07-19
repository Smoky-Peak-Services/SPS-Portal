import Link from "next/link";
import { getScheduleWeek } from "@/features/schedule/actions";
import { AssignForm } from "@/features/schedule/components/assign-form";
import { Badge } from "@/components/ui/badge";
import { formatLocation } from "@/lib/pii-join";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const data = await getScheduleWeek(week);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <p className="text-sm text-slate-500">
          Week of {data.weekStart} → {data.weekEnd} · assign techs below
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Jobs
        </h2>
        {data.jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No jobs scheduled this week.</p>
        ) : (
          data.jobs.map((job) => (
            <div
              key={job.id}
              className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-medium text-teal-900 hover:underline"
                >
                  {job.number} — {job.title}
                </Link>
                <Badge className="border-slate-200 bg-slate-50">
                  {job.status}
                </Badge>
                <span className="text-xs text-slate-500">
                  {job.scheduledFor
                    ? new Date(job.scheduledFor).toLocaleString()
                    : ""}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {job.customer?.displayName ?? "—"} ·{" "}
                {formatLocation(job.property)} ·{" "}
                {job.assignedTo?.name ?? "Unassigned"}
              </p>
              <AssignForm
                kind="job"
                id={job.id}
                techs={data.techs}
                currentUserId={job.assignedToId}
              />
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Tickets
        </h2>
        {data.tickets.length === 0 ? (
          <p className="text-sm text-slate-500">
            No tickets scheduled this week.
          </p>
        ) : (
          data.tickets.map((t) => (
            <div
              key={t.id}
              className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/tickets/${t.id}`}
                  className="font-medium text-teal-900 hover:underline"
                >
                  {t.number} — {t.title}
                </Link>
                <Badge className="border-slate-200 bg-slate-50">
                  {t.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-600">
                {t.customer?.displayName ?? "—"} ·{" "}
                {t.assignedTo?.name ?? "Unassigned"}
              </p>
              <AssignForm
                kind="ticket"
                id={t.id}
                techs={data.techs}
                currentUserId={t.assignedToId}
              />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
