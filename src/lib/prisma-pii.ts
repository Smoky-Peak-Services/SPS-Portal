/**
 * PII-tier database client.
 * Local: requires PII_DATABASE_URL.
 * Vercel: CLIENT_DB_SECRET_ARN (Secrets Manager) is planned but not wired yet —
 * until then, callers must gate on isPiiConfigured() and degrade gracefully.
 */
import { PrismaClient } from "../../prisma/generated/pii";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const g = globalThis as unknown as { piiClientPromise?: Promise<PrismaClient> };

function normalizeSsl(url: string) {
  return url.replace(
    /sslmode=(prefer|require|verify-ca)\b/i,
    "sslmode=verify-full",
  );
}

/** True when a dedicated PII database URL is present and can be used. */
export function isPiiConfigured(): boolean {
  return !!(process.env.PII_DATABASE_URL ?? "").trim();
}

/** @deprecated Prefer isPiiConfigured(). */
export function isPiiDatabaseSplit(): boolean {
  return isPiiConfigured();
}

async function resolvePiiUrl(): Promise<string> {
  const direct = (process.env.PII_DATABASE_URL ?? "").trim();
  if (direct) {
    return direct;
  }

  // Do NOT fall back to OPS_DATABASE_URL — that silently queries the wrong DB
  // (no customer/lead tables) and produces P2021 500s on Vercel.
  throw new Error(
    "PII database is not configured. Set PII_DATABASE_URL (local) or wire CLIENT_DB_SECRET_ARN (Vercel).",
  );
}

async function createClient(): Promise<PrismaClient> {
  const pool = new pg.Pool({
    connectionString: normalizeSsl(await resolvePiiUrl()),
  });
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): Promise<PrismaClient> {
  return (g.piiClientPromise ??= createClient());
}

type AnyFn = (...args: unknown[]) => unknown;

export const prismaPii = new Proxy({} as PrismaClient, {
  get(_t, prop: string | symbol) {
    if (typeof prop !== "string") return undefined;
    if (prop.startsWith("$")) {
      return (...args: unknown[]) =>
        getClient().then((c) => {
          const fn = c[prop as keyof PrismaClient] as AnyFn;
          return fn.apply(c, args);
        });
    }
    return new Proxy(
      {},
      {
        get(_t2, method: string | symbol) {
          if (typeof method !== "string") return undefined;
          return (...args: unknown[]) =>
            getClient().then((c) => {
              const model = c[prop as keyof PrismaClient] as unknown as Record<
                string,
                AnyFn
              >;
              return model[method](...args);
            });
        },
      },
    );
  },
});

export type {
  LeadStatus,
  LeadSource,
  ActivityType,
} from "../../prisma/generated/pii";
