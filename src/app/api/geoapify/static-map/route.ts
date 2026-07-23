import { getSession } from "@/lib/session";
import { staticMapUrl } from "@/lib/geoapify";

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

  const url = staticMapUrl({
    lat,
    lon,
    width: Number(sp.get("w")) || 600,
    height: Number(sp.get("h")) || 280,
    zoom: Number(sp.get("z")) || 15,
  });
  if (!url) return new Response("Maps not configured", { status: 503 });

  const upstream = await fetch(url);
  if (!upstream.ok) return new Response("Map unavailable", { status: 502 });

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
