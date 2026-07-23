import "server-only";

import { getUsRegion } from "@/features/crm/us-regions";

const KEY = process.env.GEOAPIFY_API_KEY;

const GEOAPIFY_TIMEOUT_MS = 4000;

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
};

function mapRow(r: Record<string, unknown>): AddressSuggestion {
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const line1 =
    [s("housenumber"), s("street")].filter(Boolean).join(" ") ||
    s("address_line1");
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
  };
}

/**
 * Address autocomplete scoped to a US state/territory.
 *
 * IMPORTANT: never append state/USA to `text` — that contaminates street names
 * that contain the state word (e.g. "East Tennessee" becomes numeric "SR 101" hits).
 * Hard-scope with `filter=countrycode:us`; soft-prioritize the selected state via
 * `bias=rect:…` from us-regions (no pipe-combined filter).
 */
export async function geoapifyAutocomplete(
  text: string,
  stateCode: string,
): Promise<AddressSuggestion[]> {
  if (!KEY || text.trim().length < 3) return [];
  const region = getUsRegion(stateCode);
  const want = (region?.code ?? stateCode).trim().toUpperCase();
  if (!want) return [];

  const targetStateCode = want.slice(0, 2).toLowerCase();
  const targetStateName = (region?.name ?? "").toLowerCase();

  // Raw street text only — no `, TN` / `, USA` suffix.
  const q = text.trim();
  // Hard US filter; soft state bias. Omit `type` so house-number addresses match.
  const params = new URLSearchParams({
    text: q,
    filter: "countrycode:us",
    format: "json",
    allowNonVerifiedHouseNumber: "true",
    allowNonVerifiedStreet: "true",
    limit: "6",
    apiKey: KEY,
  });
  if (region) {
    params.set(
      "bias",
      `rect:${region.rect[0]},${region.rect[1]},${region.rect[2]},${region.rect[3]}`,
    );
  }
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?${params}`;
  const redacted = new URL(url);
  redacted.searchParams.set("apiKey", "[REDACTED]");
  console.log("Geoapify Autocomplete URL:", redacted.toString());

  const res = await fetch(url, { headers: { Accept: "application/json" } });
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
  console.log("Geoapify Raw Results:", data.results);
  const rows: Array<Record<string, unknown>> =
    data.results ??
    (data.features ?? []).map((f) => f.properties ?? {});

  const filteredResults = rows.filter((item) => {
    if (!targetStateCode) return true;
    const itemStateCode = String(item.state_code ?? "").toLowerCase();
    const itemStateName = String(item.state ?? "").toLowerCase();
    if (!itemStateCode && !itemStateName) return true;
    return (
      itemStateCode === targetStateCode ||
      itemStateCode.startsWith(targetStateCode) ||
      (targetStateName !== "" && itemStateName.includes(targetStateName))
    );
  });

  return filteredResults.map(mapRow).map((s) => ({ ...s, region: want }));
}

/** Forward geocode a US address string → coordinates. */
export async function geoapifyGeocode(
  address: string,
  stateCode?: string,
): Promise<{ lat: number; lon: number } | null> {
  if (!KEY || !address.trim()) return null;

  let filter = "countrycode:us";
  let bias = "";
  if (stateCode) {
    const region = getUsRegion(stateCode);
    if (region) {
      const [lon1, lat1, lon2, lat2] = region.rect;
      bias = `&bias=rect:${lon1},${lat1},${lon2},${lat2}`;
    }
  }

  const url =
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}` +
    `&filter=${filter}${bias}&format=json&limit=1&apiKey=${KEY}`;

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
  const marker = `lonlat:${lon},${lat};type:material;color:%231d4ed8;size:large`;
  return (
    `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=${width}&height=${height}` +
    `&center=lonlat:${lon},${lat}&zoom=${zoom}&marker=${marker}&scaleFactor=2&apiKey=${KEY}`
  );
}
