/**
 * PII-tier database client.
 * Dev/local: PII_DATABASE_URL or OPS_DATABASE_URL (monolith fallback).
 */
import { PrismaClient } from "../../prisma/generated/pii";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const g = globalThis as unknown as { piiClientPromise?: Promise<PrismaClient> };

function normalizeSsl(url: string) {
  return url.replace(/sslmode=(prefer|require|verify-ca)\b/i, "sslmode=verify-full");
}

async function resolvePiiUrl(): Promise<string> {
  const direct = (process.env.PII_DATABASE_URL ?? "").trim();
  if (direct) {
    return direct;
  }

  const fallback = (process.env.OPS_DATABASE_URL ?? "").trim();
  if (!fallback) throw new Error("Set PII_DATABASE_URL (dev) or OPS_DATABASE_URL (monolith fallback)");
  console.warn("[pii] falling back to OPS_DATABASE_URL");
  return fallback;
}

async function createClient(): Promise<PrismaClient> {
  const pool = new pg.Pool({ connectionString: normalizeSsl(await resolvePiiUrl()) });
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
              const model = c[prop as keyof PrismaClient] as unknown as Record<string, AnyFn>;
              return model[method](...args);
            });
        },
      },
    );
  },
});

export function isPiiDatabaseSplit(): boolean {
  return !!(process.env.PII_DATABASE_URL ?? "").trim();
}

export type { CustomerType, LeadStatus, LeadSource, ActivityType } from "../../prisma/generated/pii";
