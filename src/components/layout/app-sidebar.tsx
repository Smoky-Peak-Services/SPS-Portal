"use client";

import Link from "next/link";
import {
  CircleUser,
  Gauge,
  Headset,
  LayoutDashboard,
  Package,
  Users,
} from "lucide-react";
import {
  filterFooterForCapabilities,
  filterNavForCapabilities,
  navSections,
} from "@/config/nav";
import { AppLogo } from "@/components/layout/app-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DeviceSurface } from "@/lib/device-surface";
import { company } from "@/config/company";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CircleUser,
  Package,
  Gauge,
  Users,
};

type Props = {
  capabilities: string[];
  userName: string;
  pathname: string;
  surface: DeviceSurface;
  className?: string;
};

export function AppSidebar({
  capabilities,
  userName,
  pathname,
  surface,
  className,
}: Props) {
  const capSet = new Set(capabilities);
  const sections = filterNavForCapabilities(capSet, navSections, surface);
  const footer = filterFooterForCapabilities(capSet, surface);

  return (
    <aside
      className={cn(
        "hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex",
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-4">
        <AppLogo variant="wordmark" />
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {userName}
        </p>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        {sections.map((section) => (
          <div key={section.id} className="mb-6">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active &&
                          "bg-sidebar-primary text-sidebar-primary-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {footer.length > 0 ? (
          <>
            <Separator className="mb-3 bg-sidebar-border" />
            <ul className="space-y-0.5">
              {footer.map((item) => {
                const Icon = ICONS[item.icon] ?? CircleUser;
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent",
                        active &&
                          "bg-sidebar-primary text-sidebar-primary-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 opacity-80" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </ScrollArea>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Headset className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-medium text-foreground">Need help?</p>
              <a
                href={`mailto:${company.email.support}`}
                className="text-[11px] text-muted-foreground hover:text-primary"
              >
                Contact support
              </a>
            </div>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
