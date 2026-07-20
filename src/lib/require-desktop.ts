import { redirect } from "next/navigation";
import { getServerSurface } from "@/lib/get-server-surface";
import {
  isDesktopOnlyPath,
  MOBILE_FALLBACK_ROUTE,
} from "@/lib/device-surface";

/** Call from desktop-only page server components. */
export async function requireDesktopSurface(pathname: string) {
  const surface = await getServerSurface();
  if (surface === "mobile" && isDesktopOnlyPath(pathname)) {
    redirect(MOBILE_FALLBACK_ROUTE);
  }
}
