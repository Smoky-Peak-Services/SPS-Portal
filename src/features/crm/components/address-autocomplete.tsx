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
  confidence: number | null;
  resultType: string | null;
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
const DEBOUNCE_MS = 500;
const BLUR_CLOSE_MS = 150;
const LOW_CONFIDENCE = 0.5;

/**
 * Address block with Geoapify autocomplete. State must be chosen first so queries
 * stay hard-scoped to that state's rect. Controlled inputs use `name`s for
 * FormData-based forms; lat/lon are hidden fields. Low confidence is flagged
 * but never blocks save.
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
  const [lowConfidence, setLowConfidence] = useState(false);
  const [noMatches, setNoMatches] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const focusedRef = useRef(false);
  const regionRef = useRef(v.region);
  const valuesRef = useRef(v);
  regionRef.current = v.region;
  valuesRef.current = v;

  const stateReady = isUsRegionCode(v.region);
  const showDropdown =
    open && (suggestions.length > 0 || loading || noMatches);

  function clearDebounce() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  function closeDropdown() {
    setOpen(false);
    setLoading(false);
    setNoMatches(false);
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
      clearDebounce();
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  function setState(code: string) {
    clearDebounce();
    requestIdRef.current += 1;
    setV((p) => ({
      ...p,
      region: code,
      lat: "",
      lon: "",
    }));
    setSuggestions([]);
    setLowConfidence(false);
    closeDropdown();
  }

  function queryLine1(text: string) {
    setV((p) => ({ ...p, line1: text, lat: "", lon: "" }));
    setLowConfidence(false);

    clearDebounce();

    const stateCode = regionRef.current;
    if (!isUsRegionCode(stateCode) || text.trim().length < MIN_QUERY_CHARS) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setNoMatches(false);
      setLoading(false);
      closeDropdown();
      return;
    }

    if (focusedRef.current) setOpen(true);

    const scheduledText = text;
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      const id = ++requestIdRef.current;
      setLoading(true);
      setNoMatches(false);
      if (focusedRef.current) setOpen(true);

      try {
        const res = await fetch(
          `/api/geoapify/autocomplete?text=${encodeURIComponent(scheduledText)}` +
            `&state=${encodeURIComponent(stateCode)}`,
        );
        const data = await res.json();
        // Ignore stale responses — do not clear suggestions for superseded queries.
        if (id !== requestIdRef.current) return;
        if (data.configured === false) setNotConfigured(true);
        const results: Suggestion[] = data.results ?? [];
        setSuggestions(results);
        setNoMatches(results.length === 0);
        if (focusedRef.current) setOpen(true);
      } catch {
        if (id !== requestIdRef.current) return;
        // Keep prior suggestions on network/parse errors.
      } finally {
        if (id === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function applyConfidence(confidence: number | null) {
    setLowConfidence(
      confidence != null && confidence < LOW_CONFIDENCE,
    );
  }

  function pick(s: Suggestion) {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    clearDebounce();
    requestIdRef.current += 1;
    setV((p) => ({
      line1: s.line1.trim(),
      line2: p.line2,
      city: s.city,
      region: s.region || p.region,
      postal: s.postalCode,
      lat: s.lat ? String(s.lat) : "",
      lon: s.lon ? String(s.lon) : "",
    }));
    applyConfidence(s.confidence);
    setSuggestions([]);
    setNoMatches(false);
    closeDropdown();

    // If autocomplete omitted confidence, validate once via search.
    if (s.confidence == null && s.line1.trim()) {
      const state = s.region || regionRef.current;
      void (async () => {
        try {
          const params = new URLSearchParams({
            line1: s.line1.trim(),
            city: s.city,
            postal: s.postalCode,
            state,
          });
          const res = await fetch(`/api/geoapify/validate?${params}`);
          const data = await res.json();
          if (data.result?.confidence != null) {
            applyConfidence(data.result.confidence);
            if (data.result.lat && data.result.lon) {
              setV((p) => ({
                ...p,
                lat: String(data.result.lat),
                lon: String(data.result.lon),
              }));
            }
          }
        } catch {
          // Validation is best-effort; never block.
        }
      })();
    }
  }

  async function revalidateOnBlur() {
    const cur = valuesRef.current;
    if (!isUsRegionCode(cur.region) || !cur.line1.trim() || !cur.city.trim()) {
      return;
    }

    try {
      const params = new URLSearchParams({
        line1: cur.line1.trim(),
        city: cur.city.trim(),
        postal: cur.postal.trim(),
        state: cur.region,
      });
      const res = await fetch(`/api/geoapify/validate?${params}`);
      const data = await res.json();
      if (data.configured === false) setNotConfigured(true);
      const result = data.result;
      if (!result) return;
      applyConfidence(result.confidence ?? null);
      if (result.lat && result.lon) {
        setV((p) => ({
          ...p,
          lat: String(result.lat),
          lon: String(result.lon),
          // Fill blanks only — do not overwrite user-edited city/ZIP.
          city: p.city.trim() ? p.city : (result.city ?? p.city),
          postal: p.postal.trim()
            ? p.postal
            : (result.postalCode ?? p.postal),
        }));
      }
    } catch {
      // Best-effort.
    }
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
              if (suggestions.length > 0 || loading || noMatches) {
                setOpen(true);
              }
            }}
            onBlur={() => {
              focusedRef.current = false;
              blurTimerRef.current = setTimeout(() => {
                closeDropdown();
                void revalidateOnBlur();
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
              ) : !loading && noMatches ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matches
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
        {lowConfidence ? (
          <p className="text-xs text-amber-400">
            Low address confidence — verify before relying on this for
            shipping. You can still save.
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
            onChange={(e) => {
              setLowConfidence(false);
              setV((p) => ({
                ...p,
                city: e.target.value,
                lat: "",
                lon: "",
              }));
            }}
            onBlur={() => void revalidateOnBlur()}
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
            onChange={(e) => {
              setLowConfidence(false);
              setV((p) => ({
                ...p,
                postal: e.target.value,
                lat: "",
                lon: "",
              }));
            }}
            onBlur={() => void revalidateOnBlur()}
            placeholder="ZIP"
          />
        </div>
      </div>

      <input type="hidden" name={names.lat} value={v.lat} />
      <input type="hidden" name={names.lon} value={v.lon} />
    </div>
  );
}
