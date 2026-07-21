"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = {
  label: string;
  href?: string;
  disabled?: boolean;
};

function tabMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Longest matching prefix among enabled tabs with an href. */
export function activeSectionTabHref(
  pathname: string,
  tabs: SectionTab[],
): string | null {
  let best: string | null = null;
  for (const tab of tabs) {
    if (tab.disabled || !tab.href) continue;
    if (!tabMatches(pathname, tab.href)) continue;
    if (!best || tab.href.length > best.length) best = tab.href;
  }
  return best;
}

export function SectionTabs({
  tabs,
  className,
}: {
  tabs: SectionTab[];
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  const activeHref = activeSectionTabHref(pathname, tabs);

  return (
    <nav
      aria-label="Section"
      className={cn("flex flex-wrap gap-1 border-b border-border", className)}
    >
      {tabs.map((tab) => {
        if (tab.disabled || !tab.href) {
          return (
            <span
              key={tab.label}
              className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground/60"
              aria-disabled="true"
            >
              {tab.label}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </span>
          );
        }

        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
