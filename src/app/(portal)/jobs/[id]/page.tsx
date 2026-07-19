import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/features/jobs/actions";
import { listFieldUsers } from "@/features/jobs/actions";
import { StatusButtons } from "@/features/jobs/components/status-buttons";
import { AssignForm } from "@/features/schedule/components/assign-form";
import { Badge } from "@/components/ui/badge";
import { formatLocation } from "@/lib/pii-join";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, techs] = await Promise.all([getJob(id), listFieldUsers()]);
  if (!job) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="text-sm text-slate-500 hover:underline">
          ← Jobs
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <Badge className="border-slate-200 bg-slate-50 font-mono">
            {job.number}
          </Badge>
          <Badge className="border-teal-200 bg-teal-50 text-teal-900">
            {job.status}
          </Badge>
        </div>
        <p className="text-sm text-slate-500">
          {job.division.name} · {job.customer?.displayName ?? "No customer"} ·{" "}
          {formatLocation(job.property)}
        </p>
      </div>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Status
        </h2>
        <StatusButtons kind="job" id={job.id} current={job.status} />
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Assign
        </h2>
        <AssignForm
          kind="job"
          id={job.id}
          techs={techs}
          currentUserId={job.assignedToId}
        />
        <p className="text-sm text-slate-600">
          Current: {job.assignedTo?.name ?? "Unassigned"}
          {job.scheduledFor
            ? ` · ${new Date(job.scheduledFor).toLocaleString()}`
            : ""}
        </p>
      </section>

      {job.description ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {job.description}
          </p>
        </section>
      ) : null}

      {job.tickets.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Linked tickets
          </h2>
          <ul className="space-y-1 text-sm">
            {job.tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tickets/${t.id}`}
                  className="text-teal-800 hover:underline"
                >
                  {t.number} — {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
