"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AppLogo } from "@/components/layout/app-logo";
import { PortalNavLinks } from "@/components/portal-nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DeviceSurface } from "@/lib/device-surface";

export function MobileNav({
  capabilities,
  userName,
  pathname,
  surface,
}: {
  capabilities: string[];
  userName: string;
  pathname: string;
  surface: DeviceSurface;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      <div className="min-w-0 flex-1">
        <AppLogo variant="wordmark" markClassName="h-7 w-7" />
        <p className="truncate text-[11px] text-muted-foreground">{userName}</p>
      </div>

      {open ? (
        <div
          className="fixed inset-0 top-[56px] z-40 bg-black/60"
          onClick={() => setOpen(false)}
        >
          <nav
            className="flex h-full w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ScrollArea className="flex-1 px-3 py-4">
              <PortalNavLinks
                capabilities={capabilities}
                pathname={pathname}
                surface={surface}
                onNavigate={() => setOpen(false)}
              />
            </ScrollArea>
            <div className="border-t border-sidebar-border px-3 py-3">
              <SignOutButton />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
