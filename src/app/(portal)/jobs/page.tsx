import Link from "next/link";
import { listJobs } from "@/features/jobs/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocation } from "@/lib/pii-join";
import { divisionTheme } from "@/config/company";

export default async function JobsPage() {
  const jobs = await listJobs();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-slate-500">
            Scheduled work units across divisions
          </p>
        </div>
        <Button asChild className="hidden shrink-0 md:inline-flex">
          <Link href="/jobs/new">New job</Link>
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No jobs yet.
          </p>
        ) : (
          jobs.map((job) => {
            const theme = divisionTheme(job.division.slug);
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className={`block rounded-lg border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${theme.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{job.title}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {job.number}
                    </div>
                  </div>
                  <Badge className="shrink-0 border-slate-200 bg-slate-50">
                    {job.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {job.customer?.displayName ?? "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {formatLocation(job.property)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {job.assignedTo?.name ?? "Unassigned"}
                  {job.scheduledFor
                    ? ` · ${new Date(job.scheduledFor).toLocaleString()}`
                    : ""}
                </p>
              </Link>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No jobs yet. Create one to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const theme = divisionTheme(job.division.slug);
                return (
                  <tr
                    key={job.id}
                    className="border-b last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-teal-800 hover:underline"
                      >
                        {job.number}
                      </Link>
                    </td>
                    <td className={`border-l-4 px-4 py-3 ${theme.border}`}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium hover:underline"
                      >
                        {job.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {formatLocation(job.property)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {job.customer?.displayName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="border-slate-200 bg-slate-50">
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {job.assignedTo?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {job.scheduledFor
                        ? new Date(job.scheduledFor).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
