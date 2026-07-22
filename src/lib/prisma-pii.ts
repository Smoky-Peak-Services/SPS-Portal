/**
 * PII-tier database client.
 * Local / seed / migrate: PII_DATABASE_URL (wins even if CLIENT_DB_SECRET_ARN is also set).
 * Vercel production: CLIENT_DB_SECRET_ARN → Secrets Manager via Vercel OIDC (AWS_ROLE_ARN).
 * Never fall back to OPS_DATABASE_URL. Callers must gate on isPiiConfigured() and degrade
 * gracefully when neither path is set.
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

/**
 * True when a dedicated PII database can be resolved:
 * PII_DATABASE_URL (local) or CLIENT_DB_SECRET_ARN (Vercel / Secrets Manager).
 */
export function isPiiConfigured(): boolean {
  return !!(
    (process.env.PII_DATABASE_URL ?? "").trim() ||
    (process.env.CLIENT_DB_SECRET_ARN ?? "").trim()
  );
}

/** @deprecated Prefer isPiiConfigured(). */
export function isPiiDatabaseSplit(): boolean {
  return isPiiConfigured();
}

async function resolvePiiUrl(): Promise<string> {
  // Local / seed / Prisma CLI: direct URL wins when set.
  const direct = (process.env.PII_DATABASE_URL ?? "").trim();
  if (direct) {
    return direct;
  }

  const arn = process.env.CLIENT_DB_SECRET_ARN?.trim();
  if (arn) {
    const roleArn = process.env.AWS_ROLE_ARN?.trim();
    if (!roleArn) {
      throw new Error(
        "CLIENT_DB_SECRET_ARN is set but AWS_ROLE_ARN is missing (required for Vercel OIDC).",
      );
    }
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );
    const { awsCredentialsProvider } = await import("@vercel/functions/oidc");
    const sm = new SecretsManagerClient({
      region: process.env.AWS_REGION?.trim() || "us-east-2",
      credentials: awsCredentialsProvider({ roleArn }),
    });
    const res = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
    if (!res.SecretString) {
      throw new Error("CLIENT_DB secret has no string value");
    }
    return res.SecretString.trim();
  }

  // Do NOT fall back to OPS_DATABASE_URL — that silently queries the wrong DB
  // (no customer/lead tables) and produces P2021 500s on Vercel.
  throw new Error(
    "PII database is not configured. Set PII_DATABASE_URL (local) or CLIENT_DB_SECRET_ARN + AWS_ROLE_ARN (Vercel).",
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
