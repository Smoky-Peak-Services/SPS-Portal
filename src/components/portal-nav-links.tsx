"use client";

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
import { isFeatureEnabled } from "@/config/company";
import {
  filterFooterForRole,
  filterNavForRole,
  navSections,
} from "@/config/nav";
import type { AppRole } from "@/config/permissions";
import { cn } from "@/lib/utils";
import type { DeviceSurface } from "@/lib/device-surface";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Wrench,
  LifeBuoy,
  Users,
  CircleUser,
};

export function PortalNavLinks({
  role,
  pathname,
  surface,
  onNavigate,
  showFooter = true,
}: {
  role: AppRole;
  pathname: string;
  surface: DeviceSurface;
  onNavigate?: () => void;
  showFooter?: boolean;
}) {
  const sections = filterNavForRole(role, navSections, surface)
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (item) => !item.feature || isFeatureEnabled(item.feature),
      ),
    }))
    .filter((s) => s.items.length > 0);

  const footer = showFooter ? filterFooterForRole(role, surface) : [];

  return (
    <>
      {sections.map((section) => (
        <div key={section.id} className="mb-6">
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
                    onClick={onNavigate}
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
      {footer.length > 0 ? (
        <div className="space-y-0.5 border-t border-slate-100 pt-3">
          {footer.map((item) => {
            const Icon = ICONS[item.icon] ?? CircleUser;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="mb-1 flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Icon className="h-4 w-4 opacity-70" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
