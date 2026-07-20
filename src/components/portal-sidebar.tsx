import { company } from "@/config/company";
import type { AppRole } from "@/config/permissions";
import { PortalNavLinks } from "@/components/portal-nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import type { DeviceSurface } from "@/lib/device-surface";

export function PortalSidebar({
  role,
  userName,
  pathname,
  surface,
}: {
  role: AppRole;
  userName: string;
  pathname: string;
  surface: DeviceSurface;
}) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="text-sm font-semibold text-[var(--brand-primary)]">
          {company.shortName}
        </div>
        <div className="truncate text-xs text-slate-500">{userName}</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <PortalNavLinks role={role} pathname={pathname} surface={surface} />
      </nav>
      <div className="border-t border-slate-200 px-3 py-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
