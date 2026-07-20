"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type StripeTaxCodeOption = {
  id: string;
  name: string;
  type: string;
  description: string;
};

export function StripeTaxCodeCombobox({
  name,
  label,
  codes,
  defaultValue,
  allowClear = true,
  placeholder = "Search by code or name…",
}: {
  name: string;
  label: string;
  codes: StripeTaxCodeOption[];
  defaultValue?: string | null;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);

  const selectedMeta = useMemo(
    () => codes.find((c) => c.id === selected) ?? null,
    [codes, selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return codes.slice(0, 40);
    return codes
      .filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [codes, query]);

  return (
    <div className="relative space-y-2">
      <Label htmlFor={`${name}-search`}>{label}</Label>
      <input type="hidden" name={name} value={selected} />
      {selectedMeta ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="font-mono text-xs text-slate-600">{selectedMeta.id}</div>
          <div className="font-medium">{selectedMeta.name}</div>
          {allowClear ? (
            <button
              type="button"
              className="mt-1 text-xs text-teal-800 hover:underline"
              onClick={() => {
                setSelected("");
                setQuery("");
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
      <Input
        id={`${name}-search`}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          // Delay so option click registers
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow-md">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">No matches</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-teal-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelected(c.id);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <div className="font-mono text-xs text-slate-500">{c.id}</div>
                  <div className="font-medium">{c.name}</div>
                  <div className="line-clamp-1 text-xs text-slate-500">
                    {c.description}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
