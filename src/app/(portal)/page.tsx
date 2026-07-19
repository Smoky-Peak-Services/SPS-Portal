import Link from "next/link";
import { requireUser } from "@/lib/session";
import { company } from "@/config/company";
import { defaultRouteForRole } from "@/config/permissions";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "field") {
    redirect(defaultRouteForRole(user.role));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Operations</h1>
        <p className="text-sm text-slate-500">
          {company.name} · Field Ops base. Tax / Stripe invoicing intentionally
          not included yet.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/jobs", title: "Jobs", desc: "Scheduled work units" },
          {
            href: "/tickets",
            title: "Service Tickets",
            desc: "Intake and triage",
          },
          { href: "/schedule", title: "Schedule", desc: "Week assignments" },
          { href: "/field/today", title: "My Day", desc: "Field tech surface" },
          { href: "/clients", title: "Clients", desc: "PII CRM records" },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow"
          >
            <div className="font-medium text-slate-900">{card.title}</div>
            <div className="text-sm text-slate-500">{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
