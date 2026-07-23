"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FormSelectOption } from "@/components/patterns/form-select";

/**
 * Searchable select for long option lists (e.g. US states).
 * Filters as you type; list is capped and scrollable so it stays on screen.
 */
export function SearchableFormSelect({
  id,
  name,
  label,
  options,
  value = "",
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  required,
  disabled,
  className,
  emptyLabel,
}: {
  id?: string;
  name?: string;
  label?: string;
  options: FormSelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Shown when value is empty (optional clear). */
  emptyLabel?: string;
}) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? emptyLabel ?? placeholder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      // Focus search after open so typing filters immediately.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function pick(next: string) {
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative space-y-2", className)}>
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setQuery("");
        }}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate text-left">{display}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute z-50 mt-1 flex w-full flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  pick(filtered[0].value);
                }
              }}
            />
          </div>
          <ul className="max-h-60 overflow-y-auto overscroll-contain p-1">
            {emptyLabel ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ""}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    value === ""
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                  onClick={() => pick("")}
                >
                  <span className="flex-1 truncate">{emptyLabel}</span>
                  {value === "" ? (
                    <CheckIcon className="size-4 shrink-0" />
                  ) : null}
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">
                No matches
              </li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      o.value === value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                    )}
                    onClick={() => pick(o.value)}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value ? (
                      <CheckIcon className="size-4 shrink-0" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
