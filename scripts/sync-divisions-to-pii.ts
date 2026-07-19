/**
 * Sync ops Division rows into the PII Division mirror (same ids).
 */
import { PrismaClient as OpsClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient as PiiClient } from "../prisma/generated/pii";

function normalizeSsl(url?: string) {
  if (!url) return url;
  return url.replace(/sslmode=(prefer|require|verify-ca)\b/i, "sslmode=verify-full");
}

async function main() {
  const opsPool = new Pool({ connectionString: normalizeSsl(process.env.OPS_DATABASE_URL) });
  const ops = new OpsClient({ adapter: new PrismaPg(opsPool) });

  const piiUrl = process.env.PII_DATABASE_URL?.trim() || process.env.OPS_DATABASE_URL;
  const piiPool = new Pool({ connectionString: normalizeSsl(piiUrl) });
  const pii = new PiiClient({ adapter: new PrismaPg(piiPool) });

  const divisions = await ops.division.findMany();
  for (const d of divisions) {
    await pii.division.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        slug: d.slug,
        name: d.name,
        segments: d.segments,
      },
      update: {
        slug: d.slug,
        name: d.name,
        segments: d.segments,
      },
    });
  }

  console.log(`Synced ${divisions.length} division(s) to PII.`);
  await ops.$disconnect();
  await pii.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
