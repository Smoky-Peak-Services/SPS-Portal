import { config } from "dotenv";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

config({ path: path.join(__dirname, "../../.env.local") });

function normalize(url?: string) {
  return url?.replace(/sslmode=(prefer|require|verify-ca)\b/i, "sslmode=verify-full");
}

const directUrl =
  normalize(process.env.PII_DIRECT_URL) ??
  normalize(process.env.OPS_DIRECT_URL) ??
  normalize(process.env.DIRECT_URL);

export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: directUrl ?? env("PII_DIRECT_URL"),
  },
});
