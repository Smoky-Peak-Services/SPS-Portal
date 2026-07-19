import { config } from "dotenv";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

config({ path: path.join(__dirname, ".env.local") });

const directUrl =
  process.env.OPS_DIRECT_URL?.replace(
    /sslmode=(prefer|require|verify-ca)\b/i,
    "sslmode=verify-full",
  ) ??
  process.env.DIRECT_URL?.replace(
    /sslmode=(prefer|require|verify-ca)\b/i,
    "sslmode=verify-full",
  );

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env.local prisma/seed.ts",
  },
  datasource: {
    url: directUrl ?? env("OPS_DIRECT_URL"),
  },
});
