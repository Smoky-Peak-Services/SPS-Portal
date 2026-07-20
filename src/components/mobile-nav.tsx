"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { company } from "@/config/company";
import { PortalNavLinks } from "@/components/portal-nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
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
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 md:hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-2"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      <Link href="/" className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[var(--brand-primary)]">
          {company.shortName}
        </div>
        <div className="truncate text-xs text-slate-500">{userName}</div>
      </Link>

      {open ? (
        <div
          className="fixed inset-0 top-[52px] z-40 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <nav
            className="flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <PortalNavLinks
                capabilities={capabilities}
                pathname={pathname}
                surface={surface}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <div className="border-t border-slate-200 px-3 py-3">
              <SignOutButton />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
