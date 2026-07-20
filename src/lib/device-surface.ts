export type DeviceSurface = "mobile" | "desktop";

export const SURFACE_COOKIE = "sps_surface";
export const MOBILE_MAX_WIDTH = 768;

/** Client-side: narrow viewport = mobile surface. */
export function surfaceFromViewportWidth(width: number): DeviceSurface {
  return width < MOBILE_MAX_WIDTH ? "mobile" : "desktop";
}

/**
 * Routes that require a desktop surface (mobile redirects away).
 * Empty for now — the dashboard-only shell works on any surface. Add
 * desktop-only routes back here as features that need them are rebuilt.
 */
export function isDesktopOnlyPath(_pathname: string): boolean {
  return false;
}

export const MOBILE_FALLBACK_ROUTE = "/";
