import { requireUser } from "@/lib/session";
import { company } from "@/config/company";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {company.name}
        </h1>
        <p className="text-sm text-slate-500">
          Signed in as {user.name} ({user.role}). This is a dashboard shell —
          the portal is being rebuilt piece by piece, starting with
          quoting/estimating.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Nothing to see yet. New sections will show up here as they are built
        and tested.
      </div>
    </div>
  );
}
