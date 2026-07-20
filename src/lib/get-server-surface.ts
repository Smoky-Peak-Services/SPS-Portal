import { headers } from "next/headers";
import {
  SURFACE_COOKIE,
  type DeviceSurface,
} from "@/lib/device-surface";

/**
 * Server-side surface hint.
 * Prefer Sec-CH-UA-Mobile, then sps_surface cookie (set by client), else desktop.
 */
export async function getServerSurface(): Promise<DeviceSurface> {
  const h = await headers();
  const chMobile = h.get("sec-ch-ua-mobile");
  if (chMobile === "?1") return "mobile";
  if (chMobile === "?0") return "desktop";

  const cookie = h.get("cookie") ?? "";
  const match = cookie.match(
    new RegExp(`(?:^|;\\s*)${SURFACE_COOKIE}=(mobile|desktop)`),
  );
  if (match?.[1] === "mobile" || match?.[1] === "desktop") {
    return match[1];
  }

  return "desktop";
}
