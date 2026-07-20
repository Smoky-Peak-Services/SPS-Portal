import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/accept-invite",
  "/api/auth",
  "/api/v1/leads",
  "/_next",
  "/favicon",
  "/brand/",
  "/sw.js",
  "/manifest.webmanifest",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("session_token") || c.name.startsWith("better-auth"),
    );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/v1/leads") &&
    req.method !== "POST" &&
    req.method !== "OPTIONS"
  ) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
