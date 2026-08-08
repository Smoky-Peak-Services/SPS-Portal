"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsed summary row for catalog admin edit cards; expands in place to show
 * the full form. Does not own Save/Delete — pass the form as children.
 */
export function CatalogEditRollup({
  title,
  meta,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const panelId = useId();
  const isControlled = openControlled !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? openControlled : internalOpen;

  function setOpen(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          open && "border-b border-border",
        )}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            {title}
          </span>
          {meta ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {open ? "Collapse" : "Edit"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="p-4 pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
