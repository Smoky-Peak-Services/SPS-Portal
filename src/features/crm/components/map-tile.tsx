"use client";

/**
 * Static map tile (server-proxied Geoapify). Renders nothing if coords are missing.
 */
export function MapTile({
  lat,
  lon,
  label,
  className = "",
}: {
  lat: number | null | undefined;
  lon: number | null | undefined;
  label?: string;
  className?: string;
}) {
  if (lat == null || lon == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const src = `/api/geoapify/static-map?lat=${lat}&lon=${lon}&w=600&h=240&z=15`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- proxied static map, not a Next Image asset
    <img
      src={src}
      alt={label ? `Map of ${label}` : "Location map"}
      width={600}
      height={240}
      className={`h-auto w-full rounded-lg border border-border ${className}`}
    />
  );
}
