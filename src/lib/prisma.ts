import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function normalizeSsl(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(
    /sslmode=(prefer|require|verify-ca)\b/i,
    "sslmode=verify-full",
  );
}

function createPrismaClient() {
  const pool = new Pool({
    connectionString: normalizeSsl(process.env.OPS_DATABASE_URL),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
