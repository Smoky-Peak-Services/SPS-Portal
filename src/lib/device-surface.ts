export type DeviceSurface = "mobile" | "desktop";

export const SURFACE_COOKIE = "sps_surface";
export const MOBILE_MAX_WIDTH = 768;

/** Client-side: narrow viewport = mobile surface. */
export function surfaceFromViewportWidth(width: number): DeviceSurface {
  return width < MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

/**
 * Routes that require a desktop surface (mobile redirects away).
 * Materials admin is desktop-only; add more as features that need them rebuild.
 */
export function isDesktopOnlyPath(pathname: string): boolean {
  return (
    pathname === "/materials" ||
    pathname.startsWith("/materials/") ||
    pathname === "/pricing" ||
    pathname.startsWith("/pricing/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  );
}

export const MOBILE_FALLBACK_ROUTE = "/";
