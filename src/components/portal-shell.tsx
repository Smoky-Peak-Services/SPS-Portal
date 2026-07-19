"use client";

import { usePathname } from "next/navigation";
import { PortalSidebar } from "@/components/portal-sidebar";
import type { AppRole } from "@/config/permissions";

export function PortalShell({
  role,
  userName,
  children,
}: {
  role: AppRole;
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="flex min-h-screen">
      <PortalSidebar role={role} userName={userName} pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
