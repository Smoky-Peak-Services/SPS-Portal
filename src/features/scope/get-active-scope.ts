/**
 * Server-side active-scope plumbing (prompt 15). RSC pages call
 * `getActiveScope(await searchParams)`; layouts call `listScopeDivisions` +
 * `resolveActiveScope` directly (layouts have no searchParams).
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { operationalDivisionSlugs } from "@/config/company";
import {
  ACTIVE_SCOPE_COOKIE,
  resolveActiveScope,
  type ActiveScope,
  type ScopeDivision,
} from "./active-scope";

/** Operational divisions only — the legal entity never owns catalog data. */
export async function listScopeDivisions(): Promise<ScopeDivision[]> {
  await requireUser();
  return prisma.division.findMany({
    where: { slug: { in: [...operationalDivisionSlugs()] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function readActiveScopeCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_SCOPE_COOKIE)?.value ?? null;
}

/**
 * Canonical resolver for pages: URL params → cookie → IS-Commercial default.
 * Throws only when no operational divisions exist in the database.
 */
export async function getActiveScope(searchParams?: {
  divisionId?: string;
  segment?: string;
}): Promise<ActiveScope> {
  const [divisions, cookie] = await Promise.all([
    listScopeDivisions(),
    readActiveScopeCookie(),
  ]);
  const scope = resolveActiveScope({
    divisions,
    url: searchParams,
    cookie,
  });
  if (!scope) {
    throw new Error(
      "No operational divisions configured — run npm run db:seed",
    );
  }
  return scope;
}
