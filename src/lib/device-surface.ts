export type DeviceSurface = "mobile" | "desktop";

export const SURFACE_COOKIE = "sps_surface";
export const MOBILE_MAX_WIDTH = 768;

/** Client-side: narrow viewport = mobile surface. */
export function surfaceFromViewportWidth(width: number): DeviceSurface {
  return width < MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

/** Routes that require a desktop surface (mobile redirects away). */
export function isDesktopOnlyPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/jobs/new" || pathname.startsWith("/jobs/new/")) return true;
  if (pathname === "/tickets/new" || pathname.startsWith("/tickets/new/")) return true;
  if (pathname === "/clients" || pathname.startsWith("/clients/")) return true;
  return false;
}

export const MOBILE_FALLBACK_ROUTE = "/field/today";
