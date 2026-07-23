"use client";

import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = {
  value: string;
  label: string;
};

const EMPTY_TOKEN = "__empty__";

/**
 * Themed, accessible select for forms and filters.
 * Prefer this over native `<select>` so option lists use portal tokens
 * (WCAG-AA contrast) instead of the OS dropdown.
 */
export function FormSelect({
  id,
  name,
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  required,
  disabled,
  className,
  triggerClassName,
  allowEmpty,
  emptyLabel,
}: {
  id?: string;
  /** When set, a hidden input is kept in sync for FormData / GET forms. */
  name?: string;
  label?: string;
  options: FormSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Adds an empty option that submits as "". */
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const autoId = useId();
  const selectId = id ?? autoId;

  function toInternal(v: string | undefined): string {
    if (v == null || v === "") {
      return allowEmpty ? EMPTY_TOKEN : (options[0]?.value ?? EMPTY_TOKEN);
    }
    return v;
  }

  function toExternal(v: string): string {
    return v === EMPTY_TOKEN ? "" : v;
  }

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() =>
    toInternal(value ?? defaultValue),
  );
  const current = isControlled ? toInternal(value) : internal;
  const external = toExternal(current);

  const allOptions: FormSelectOption[] = allowEmpty
    ? [{ value: EMPTY_TOKEN, label: emptyLabel ?? placeholder }, ...options]
    : options;

  const labelFor = (v: string | null) => {
    const key = v ?? (allowEmpty ? EMPTY_TOKEN : "");
    return allOptions.find((o) => o.value === key)?.label ?? placeholder;
  };

  function handleChange(next: string | null) {
    if (next == null) return;
    if (!isControlled) setInternal(next);
    onValueChange?.(toExternal(next));
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      {name ? <input type="hidden" name={name} value={external} /> : null}
      <Select
        value={current}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={selectId}
          aria-label={label ?? placeholder}
          aria-required={required || undefined}
          className={cn("h-9 w-full min-w-0", triggerClassName)}
        >
          <SelectValue>{(v: string | null) => labelFor(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="max-h-60 border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {allOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
