import "server-only";

import { getUsRegion } from "@/features/crm/us-regions";

const KEY = process.env.GEOAPIFY_API_KEY;

const GEOAPIFY_TIMEOUT_MS = 4000;

/** Soft-flag threshold — never block save below this; UI warns only. */
export const LOW_CONFIDENCE = 0.5;

export function geoapifyConfigured(): boolean {
  return !!KEY;
}

export type AddressSuggestion = {
  formatted: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat: number;
  lon: number;
  confidence: number | null;
  resultType: string | null;
};

export type AddressValidation = {
  formatted: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  lat: number;
  lon: number;
  confidence: number | null;
  resultType: string | null;
};

/** Hard geographic filter: state rect AND US (Geoapify AND via `|`). */
function hardFilterForState(stateCode: string): string | null {
  const region = getUsRegion(stateCode);
  if (!region) return null;
  const [lon1, lat1, lon2, lat2] = region.rect;
  return `rect:${lon1},${lat1},${lon2},${lat2}|countrycode:us`;
}

function readConfidence(r: Record<string, unknown>): number | null {
  const rank = r.rank;
  if (rank && typeof rank === "object" && !Array.isArray(rank)) {
    const c = (rank as Record<string, unknown>).confidence;
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string" && c.trim() !== "" && !Number.isNaN(Number(c))) {
      return Number(c);
    }
  }
  if (typeof r.confidence === "number" && Number.isFinite(r.confidence)) {
    return r.confidence;
  }
  return null;
}

function mapRow(r: Record<string, unknown>): AddressSuggestion {
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const line1 =
    [s("housenumber"), s("street")].filter(Boolean).join(" ") ||
    s("address_line1");
  const resultType =
    typeof r.result_type === "string" ? r.result_type : null;
  return {
    formatted: s("formatted"),
    line1,
    line2: "",
    city: s("city") || s("county"),
    region: s("state_code") || s("state"),
    postalCode: s("postcode"),
    country: (s("country_code") || "us").toUpperCase(),
    lat: Number(r.lat) || 0,
    lon: Number(r.lon) || 0,
    confidence: readConfidence(r),
    resultType,
  };
}

function matchesSelectedState(
  item: Record<string, unknown>,
  wantCode: string,
  wantName: string,
): boolean {
  const itemStateCode = String(item.state_code ?? "")
    .trim()
    .toLowerCase();
  const itemStateName = String(item.state ?? "")
    .trim()
    .toLowerCase();
  if (!itemStateCode && !itemStateName) return true;
  const code = wantCode.toLowerCase();
  return (
    itemStateCode === code ||
    itemStateCode.startsWith(code) ||
    (wantName !== "" && itemStateName.includes(wantName))
  );
}

/**
 * Address autocomplete scoped to a US state/territory.
 *
 * IMPORTANT: never append state/USA to `text` — that contaminates street names
 * that contain the state word (e.g. "East Tennessee").
 * Hard-scope with `filter=rect:…|countrycode:us` (documented AND combine).
 */
export async function geoapifyAutocomplete(
  text: string,
  stateCode: string,
): Promise<AddressSuggestion[]> {
  if (!KEY || text.trim().length < 3) return [];
  const region = getUsRegion(stateCode);
  const want = (region?.code ?? stateCode).trim().toUpperCase();
  if (!want) return [];

  const filter = hardFilterForState(want);
  if (!filter) return [];

  const q = text.trim();
  const wantName = (region?.name ?? "").toLowerCase();

  // Encode only text + apiKey; leave `|`, `:`, `,` in filter literal.
  const url =
    `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}` +
    `&filter=${filter}` +
    `&format=json&limit=6&lang=en` +
    `&apiKey=${encodeURIComponent(KEY)}`;

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Geoapify autocomplete network/timeout:", err);
    return [];
  }

  if (!res.ok) {
    console.error(
      "Geoapify API Error:",
      res.status,
      res.statusText,
      await res.text(),
    );
    return [];
  }

  const data = (await res.json()) as {
    results?: Array<Record<string, unknown>>;
    features?: Array<{ properties?: Record<string, unknown> }>;
  };
  const rows: Array<Record<string, unknown>> =
    data.results ??
    (data.features ?? []).map((f) => f.properties ?? {});

  const filtered = rows.filter((item) =>
    matchesSelectedState(item, want, wantName),
  );

  console.log(
    `Geoapify autocomplete: ${filtered.length}/${rows.length} results in ${Date.now() - started}ms (state=${want})`,
  );

  return filtered.map(mapRow).map((s) => ({ ...s, region: want }));
}

/**
 * Forward-geocode validate: confidence + coords for a composed address.
 * Soft-flag when confidence < LOW_CONFIDENCE; callers must not block save.
 */
export async function geoapifyValidateAddress(
  parts: {
    line1: string;
    city?: string;
    postal?: string;
    region: string;
  },
  stateCode?: string,
): Promise<AddressValidation | null> {
  if (!KEY) return null;
  const state = (stateCode ?? parts.region).trim().toUpperCase();
  const filter = hardFilterForState(state);
  if (!filter) return null;

  const text = [parts.line1, parts.city, state, parts.postal]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!text) return null;

  const url =
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}` +
    `&filter=${filter}` +
    `&format=json&limit=1&lang=en` +
    `&apiKey=${encodeURIComponent(KEY)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Geoapify validate network/timeout:", err);
    return null;
  }

  if (!res.ok) {
    console.error(
      "Geoapify API Error:",
      res.status,
      res.statusText,
      await res.text(),
    );
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<Record<string, unknown>>;
    features?: Array<{ properties?: Record<string, unknown> }>;
  };
  const rows: Array<Record<string, unknown>> =
    data.results ??
    (data.features ?? []).map((f) => f.properties ?? {});
  const hit = rows[0];
  if (!hit) return null;

  const mapped = mapRow(hit);
  return {
    formatted: mapped.formatted,
    line1: mapped.line1,
    city: mapped.city,
    region: state,
    postalCode: mapped.postalCode,
    lat: mapped.lat,
    lon: mapped.lon,
    confidence: mapped.confidence,
    resultType: mapped.resultType,
  };
}

/** Forward geocode a US address string → coordinates. */
export async function geoapifyGeocode(
  address: string,
  stateCode?: string,
): Promise<{ lat: number; lon: number } | null> {
  if (!KEY || !address.trim()) return null;

  const filter = stateCode
    ? (hardFilterForState(stateCode) ?? "countrycode:us")
    : "countrycode:us";

  const url =
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address.trim())}` +
    `&filter=${filter}` +
    `&format=json&limit=1&apiKey=${encodeURIComponent(KEY)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(GEOAPIFY_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results?: Array<{ lat?: number; lon?: number }>;
  };
  const hit = data.results?.[0];
  if (!hit || hit.lat == null || hit.lon == null) return null;
  return { lat: Number(hit.lat), lon: Number(hit.lon) };
}

/** Static map image URL (includes key — only fetched server-side by the proxy route). */
export function staticMapUrl(opts: {
  lat: number;
  lon: number;
  width?: number;
  height?: number;
  zoom?: number;
}): string | null {
  if (!KEY) return null;
  const { lat, lon, width = 600, height = 280, zoom = 15 } = opts;
  // Brand teal (#0D9488). size must be pixels (not large/x-large) per current Static Maps API.
  const marker =
    `lonlat:${lon},${lat};type:awesome;color:%230D9488;size:64` +
    `;icon:location-dot;icontype:awesome;contentcolor:%23ffffff;whitecircle:no`;
  return (
    `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=${width}&height=${height}` +
    `&center=lonlat:${lon},${lat}&zoom=${zoom}&marker=${marker}&scaleFactor=2&apiKey=${KEY}`
  );
}
