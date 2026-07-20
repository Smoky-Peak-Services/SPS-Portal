"use client";

import { useEffect, useState } from "react";
import {
  MOBILE_MAX_WIDTH,
  SURFACE_COOKIE,
  surfaceFromViewportWidth,
  type DeviceSurface,
} from "@/lib/device-surface";

function writeSurfaceCookie(surface: DeviceSurface) {
  document.cookie = `${SURFACE_COOKIE}=${surface}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Tracks viewport surface and syncs a cookie for server route guards. */
export function useDeviceSurface(): DeviceSurface {
  const [surface, setSurface] = useState<DeviceSurface>("desktop");

  useEffect(() => {
    const update = () => {
      const next = surfaceFromViewportWidth(window.innerWidth);
      setSurface(next);
      writeSurfaceCookie(next);
    };
    update();
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH - 1}px)`);
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return surface;
}
