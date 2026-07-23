"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
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

const MIN_QUERY_CHARS = 4;
const DEBOUNCE_MS = 350;
const BLUR_CLOSE_MS = 150;

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
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const focusedRef = useRef(false);
  const regionRef = useRef(v.region);
  regionRef.current = v.region;

  const stateReady = isUsRegionCode(v.region);
  const showDropdown = open && (suggestions.length > 0 || loading);

  function cancelPending() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function closeDropdown() {
    setOpen(false);
    setLoading(false);
  }

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) {
        focusedRef.current = false;
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function setState(code: string) {
    cancelPending();
    setV((p) => ({
      ...p,
      region: code,
      lat: "",
      lon: "",
    }));
    setSuggestions([]);
    closeDropdown();
  }

  function queryLine1(text: string) {
    setV((p) => ({ ...p, line1: text, lat: "", lon: "" }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const stateCode = regionRef.current;
    if (!isUsRegionCode(stateCode) || text.trim().length < MIN_QUERY_CHARS) {
      cancelPending();
      setSuggestions([]);
      closeDropdown();
      return;
    }

    // Keep prior suggestions visible while debouncing; open while focused.
    if (focusedRef.current) setOpen(true);

    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      if (focusedRef.current) setOpen(true);

      try {
        const res = await fetch(
          `/api/geoapify/autocomplete?text=${encodeURIComponent(text)}` +
            `&state=${encodeURIComponent(stateCode)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (data.configured === false) setNotConfigured(true);
        // Trust API payload as-is — no client-side street/includes or slice(0,1).
        const results: Suggestion[] = data.results ?? [];
        setSuggestions(results);
        if (focusedRef.current) setOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Network / parse errors: keep prior suggestions.
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    }, DEBOUNCE_MS);
  }

  function pick(s: Suggestion) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    cancelPending();
    // Street = housenumber + street (mapped to line1 server-side); fill city + ZIP.
    setV((p) => ({
      line1: s.line1.trim(),
      line2: p.line2,
      city: s.city,
      region: s.region || p.region,
      postal: s.postalCode,
      lat: s.lat ? String(s.lat) : "",
      lon: s.lon ? String(s.lon) : "",
    }));
    setSuggestions([]);
    closeDropdown();
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

      <div className="space-y-2">
        <Label htmlFor={names.line1}>Street address</Label>
        <div ref={boxRef} className="relative">
          <Input
            id={names.line1}
            name={names.line1}
            required={required}
            autoComplete="off"
            disabled={!stateReady}
            value={v.line1}
            onChange={(e) => queryLine1(e.target.value)}
            onFocus={() => {
              focusedRef.current = true;
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              if (suggestions.length > 0 || loading) setOpen(true);
            }}
            onBlur={() => {
              focusedRef.current = false;
              blurTimerRef.current = setTimeout(() => {
                closeDropdown();
              }, BLUR_CLOSE_MS);
            }}
            placeholder={stateReady ? "Street address" : "Select state first"}
          />
          {showDropdown ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Searching…
                </div>
              ) : null}
              {suggestions.length > 0 ? (
                <ul>
                  {suggestions.map((s, i) => (
                    <li key={`${s.formatted}-${i}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(s)}
                        className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{s.formatted}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : loading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Looking up addresses…
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {notConfigured ? (
          <p className="text-xs text-amber-400">
            Address lookup is not configured (missing API key). Enter the
            address manually.
          </p>
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
