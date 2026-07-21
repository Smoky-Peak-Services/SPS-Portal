"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";

/** Slow poll to detect server-side revocation — not for sliding session renewal. */
const REVOKE_CHECK_MS = 5 * 60_000;

/** Must stay below Better Auth expiresIn (60 min). */
const IDLE_MS =
  (Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES ?? "45") || 45) * 60_000;

/** Align with Better Auth updateAge — don't spam get-session. */
const SESSION_REFRESH_MS = 5 * 60_000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
] as const;

/**
 * Signs the user out after real idle time (no pointer/keyboard activity) and
 * refreshes the Better Auth session cookie on activity so active users stay signed in.
 * RSC getSession uses disableRefresh — cookie sliding must happen here.
 */
export function SessionWatchdog() {
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();
  const hadSession = useRef(false);
  const lastActivity = useRef(0);
  const lastRefresh = useRef(0);
  const signingOut = useRef(false);

  const refreshSessionCookie = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < SESSION_REFRESH_MS) return;
    lastRefresh.current = now;
    void authClient.getSession();
  }, []);

  const touchActivity = useCallback(() => {
    lastActivity.current = Date.now();
    refreshSessionCookie();
  }, [refreshSessionCookie]);

  useEffect(() => {
    lastActivity.current = Date.now();
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, touchActivity, { passive: true });
    }
    const onVis = () => {
      if (document.visibilityState === "visible") touchActivity();
    };
    document.addEventListener("visibilitychange", onVis);
    // Initial refresh shortly after mount so cookie slides on page load.
    refreshSessionCookie();
    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, touchActivity);
      }
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [touchActivity, refreshSessionCookie]);

  useEffect(() => {
    if (session) hadSession.current = true;
  }, [session]);

  useEffect(() => {
    if (isPending) return;
    if (hadSession.current && !session) {
      if (signingOut.current) return;
      hadSession.current = false;
      router.replace("/sign-in?reason=expired");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    const idleTimer = setInterval(() => {
      if (!hadSession.current || signingOut.current) return;
      if (lastActivity.current === 0) return;
      if (Date.now() - lastActivity.current < IDLE_MS) return;
      signingOut.current = true;
      void authClient.signOut().finally(() => {
        hadSession.current = false;
        router.replace("/sign-in?reason=idle");
      });
    }, 30_000);

    const revokeTimer = setInterval(() => {
      if (!hadSession.current) return;
      void refetch();
    }, REVOKE_CHECK_MS);

    return () => {
      clearInterval(idleTimer);
      clearInterval(revokeTimer);
    };
  }, [refetch, router]);

  return null;
}
