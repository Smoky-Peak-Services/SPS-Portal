"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { useDeviceSurface } from "@/hooks/use-device-surface";

export function PortalShell({
  capabilities,
  userName,
  children,
}: {
  capabilities: string[];
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const surface = useDeviceSurface();

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <MobileNav
        capabilities={capabilities}
        userName={userName}
        pathname={pathname}
        surface={surface}
      />
      <AppSidebar
        capabilities={capabilities}
        userName={userName}
        pathname={pathname}
        surface={surface}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
