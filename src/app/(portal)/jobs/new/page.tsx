import Link from "next/link";
import { JobCreateForm } from "@/features/jobs/components/job-create-form";
import { listFieldUsers } from "@/features/jobs/actions";
import { listCustomerOptions } from "@/features/crm/actions";
import { listDivisions } from "@/features/schedule/actions";

export default async function NewJobPage() {
  const [divisions, customers, techs] = await Promise.all([
    listDivisions(),
    listCustomerOptions(),
    listFieldUsers(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/jobs" className="text-sm text-slate-500 hover:underline">
          ← Jobs
        </Link>
        <h1 className="text-2xl font-semibold">New job</h1>
      </div>
      <JobCreateForm
        divisions={divisions}
        customers={customers}
        techs={techs}
      />
    </div>
  );
}
