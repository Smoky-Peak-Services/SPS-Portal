import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/session";
import { staticMapUrl } from "@/lib/geoapify";

/** Browser + server cache TTL for static map tiles (avoids Geoapify hits each load). */
const MAP_CACHE_SECONDS = 72 * 60 * 60; // 72 hours

type CachedMap = {
  bodyBase64: string;
  contentType: string;
};

async function fetchMapFromGeoapify(url: string): Promise<CachedMap> {
  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(
      `Geoapify static map ${upstream.status}: ${detail.slice(0, 200)}`,
    );
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  return {
    bodyBase64: buf.toString("base64"),
    contentType: upstream.headers.get("Content-Type") ?? "image/png",
  };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return new Response("Bad request", { status: 400 });
  }

  const width = Number(sp.get("w")) || 600;
  const height = Number(sp.get("h")) || 280;
  const zoom = Number(sp.get("z")) || 15;

  const url = staticMapUrl({ lat, lon, width, height, zoom });
  if (!url) return new Response("Maps not configured", { status: 503 });

  // Cache key is lat/lon/size only (not the API key). Failures are not cached —
  // unstable_cache only stores successful return values.
  const cacheKey = [
    "geoapify-static-map",
    lat.toFixed(5),
    lon.toFixed(5),
    String(width),
    String(height),
    String(zoom),
    "teal-v3",
  ];

  try {
    const cached = await unstable_cache(
      async () => fetchMapFromGeoapify(url),
      cacheKey,
      { revalidate: MAP_CACHE_SECONDS },
    )();

    return new Response(Buffer.from(cached.bodyBase64, "base64"), {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": `private, max-age=${MAP_CACHE_SECONDS}`,
      },
    });
  } catch (err) {
    console.error("Static map proxy error:", err);
    return new Response("Map unavailable", { status: 502 });
  }
}
