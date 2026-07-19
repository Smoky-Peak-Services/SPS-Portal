import { requireUser } from "@/lib/session";
import { ROLE_LABELS } from "@/config/permissions";
import { company } from "@/config/company";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
        <dl className="space-y-3">
          <div>
            <dt className="text-xs uppercase text-slate-500">Name</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Role</dt>
            <dd>{ROLE_LABELS[user.role]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Company</dt>
            <dd>{company.name}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
