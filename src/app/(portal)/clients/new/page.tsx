import Link from "next/link";
import { CustomerCreateForm } from "@/features/crm/components/customer-create-form";
import { listDivisions } from "@/features/schedule/actions";
import { requireDesktopSurface } from "@/lib/require-desktop";
import { isPiiConfigured } from "@/lib/prisma-pii";
import { PiiUnavailableNotice } from "@/components/pii-unavailable-notice";

export default async function NewClientPage() {
  await requireDesktopSurface("/clients/new");

  if (!isPiiConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <Link
            href="/clients"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Clients
          </Link>
          <h1 className="text-2xl font-semibold">New client</h1>
        </div>
        <PiiUnavailableNotice />
      </div>
    );
  }

  const divisions = await listDivisions();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/clients"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Clients
        </Link>
        <h1 className="text-2xl font-semibold">New client</h1>
      </div>
      <CustomerCreateForm divisions={divisions} />
    </div>
  );
}
