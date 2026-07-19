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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-slate-500">
            Scheduled work units across divisions
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">New job</Link>
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
                    <td className="px-4 py-3">{job.assignedTo?.name ?? "—"}</td>
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
