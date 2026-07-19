import Link from "next/link";
import {
  Calendar,
  CircleUser,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  Users,
  Wrench,
} from "lucide-react";
import { company, isFeatureEnabled } from "@/config/company";
import { filterNavForRole, navFooterItems, navSections } from "@/config/nav";
import type { AppRole } from "@/config/permissions";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Wrench,
  LifeBuoy,
  Users,
  CircleUser,
};

export function PortalSidebar({
  role,
  userName,
  pathname,
}: {
  role: AppRole;
  userName: string;
  pathname: string;
}) {
  const sections = filterNavForRole(role, navSections)
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (item) => !item.feature || isFeatureEnabled(item.feature),
      ),
    }))
    .filter((s) => s.items.length > 0);

  const footer = navFooterItems.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-sm font-semibold text-[var(--brand-primary)]">
          {company.shortName}
        </div>
        <div className="truncate text-xs text-slate-500">{userName}</div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.id}>
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {section.label}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100",
                        active && "bg-teal-50 font-medium text-teal-900",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-3 py-3">
        {footer.map((item) => {
          const Icon = ICONS[item.icon] ?? CircleUser;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Icon className="h-4 w-4 opacity-70" />
              {item.label}
            </Link>
          );
        })}
        <SignOutButton />
      </div>
    </aside>
  );
}
