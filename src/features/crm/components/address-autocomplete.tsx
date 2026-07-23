"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { SearchableFormSelect } from "@/components/patterns/searchable-form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { US_REGION_OPTIONS, isUsRegionCode } from "@/features/crm/us-regions";

type FieldNames = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  lat: string;
  lon: string;
};

type Suggestion = {
  formatted: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat: number;
  lon: number;
};

type AddressValues = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  lat: string;
  lon: string;
};

const empty: AddressValues = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal: "",
  lat: "",
  lon: "",
};

/** Fire autocomplete only every 4 characters (4, 8, 12, …) once past the floor. */
function shouldQuery(text: string): boolean {
  const len = text.trim().length;
  return len >= 4 && len % 4 === 0;
}

/**
 * Address block with Geoapify autocomplete. State must be chosen first so queries
 * stay scoped. Controlled inputs use `name`s for FormData-based forms; lat/lon
 * are hidden fields.
 */
export function AddressAutocomplete({
  names,
  defaults,
  required,
  legend,
}: {
  names: FieldNames;
  defaults?: Partial<AddressValues>;
  required?: boolean;
  legend?: string;
}) {
  const [v, setV] = useState<AddressValues>({ ...empty, ...defaults });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateReady = isUsRegionCode(v.region);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function setState(code: string) {
    setV((p) => ({
      ...p,
      region: code,
      // Changing state invalidates prior geocode.
      lat: "",
      lon: "",
    }));
    setSuggestions([]);
    setOpen(false);
  }

  function queryLine1(text: string) {
    const stateCode = v.region;
    setV((p) => ({ ...p, line1: text, lat: "", lon: "" }));
    if (timer.current) clearTimeout(timer.current);

    if (!isUsRegionCode(stateCode) || !shouldQuery(text)) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geoapify/autocomplete?text=${encodeURIComponent(text)}` +
            `&state=${encodeURIComponent(stateCode)}`,
        );
        const data = await res.json();
        if (data.configured === false) setNotConfigured(true);
        const results: Suggestion[] = data.results ?? [];
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }

  function pick(s: Suggestion) {
    setV({
      line1: s.line1,
      line2: v.line2,
      city: s.city,
      region: s.region || v.region,
      postal: s.postalCode,
      lat: s.lat ? String(s.lat) : "",
      lon: s.lon ? String(s.lon) : "",
    });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div className="space-y-3">
      {legend ? (
        <p className="text-sm font-medium text-foreground">{legend}</p>
      ) : null}

      <SearchableFormSelect
        name={names.region}
        label="State / territory"
        options={US_REGION_OPTIONS}
        value={v.region}
        onValueChange={setState}
        placeholder="Select state first"
        searchPlaceholder="Search state or territory…"
        required={required}
        emptyLabel="Select state first"
      />

      {!stateReady ? (
        <p className="text-xs text-muted-foreground">
          Select a state or territory before entering the street address.
          Lookups stay scoped to that region.
        </p>
      ) : null}

      <div ref={boxRef} className="relative space-y-2">
        <div className="space-y-2">
          <Label htmlFor={names.line1}>Street address</Label>
          <Input
            id={names.line1}
            name={names.line1}
            required={required}
            autoComplete="off"
            disabled={!stateReady}
            value={v.line1}
            onChange={(e) => queryLine1(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            placeholder={
              stateReady
                ? "Start typing (lookup every 4 characters)"
                : "Select state first"
            }
          />
        </div>
        {notConfigured ? (
          <p className="text-xs text-amber-400">
            Address lookup is not configured (missing API key). Enter the
            address manually.
          </p>
        ) : null}
        {open ? (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {suggestions.map((s, i) => (
              <li key={`${s.formatted}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{s.formatted}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={names.line2}>Unit / suite (optional)</Label>
        <Input
          id={names.line2}
          name={names.line2}
          disabled={!stateReady}
          value={v.line2}
          onChange={(e) => setV((p) => ({ ...p, line2: e.target.value }))}
          placeholder="Apt, suite, floor"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={names.city}>City</Label>
          <Input
            id={names.city}
            name={names.city}
            required={required}
            disabled={!stateReady}
            value={v.city}
            onChange={(e) =>
              setV((p) => ({ ...p, city: e.target.value, lat: "", lon: "" }))
            }
            placeholder="City"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={names.postal}>ZIP</Label>
          <Input
            id={names.postal}
            name={names.postal}
            required={required}
            disabled={!stateReady}
            value={v.postal}
            onChange={(e) =>
              setV((p) => ({ ...p, postal: e.target.value, lat: "", lon: "" }))
            }
            placeholder="ZIP"
          />
        </div>
      </div>

      <input type="hidden" name={names.lat} value={v.lat} />
      <input type="hidden" name={names.lon} value={v.lon} />
    </div>
  );
}
