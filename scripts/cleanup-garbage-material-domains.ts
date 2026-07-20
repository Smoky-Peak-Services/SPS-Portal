/**
 * One-shot cleanup of empty domains created by a mistaken attribute-lists upload.
 * Safe-deletes only (skips any domain that has categories).
 *
 * Usage: npx tsx --env-file=.env.local scripts/cleanup-garbage-material-domains.ts
 */
import { prisma } from "../src/lib/prisma";
import { nameMatchKey } from "../src/features/materials/normalize";

const GARBAGE_NAMES = [
  "Attribute Lists",
  "attachment_type_pathways",
  "box_length",
  "color",
  "length_feet",
  "manufacturer",
  "vendor",
];

async function main() {
  const targets = new Set(GARBAGE_NAMES.map((n) => nameMatchKey(n)));
  const domains = await prisma.materialDomain.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { categories: true } },
    },
  });

  const matched = domains.filter((d) => targets.has(nameMatchKey(d.name)));
  if (matched.length === 0) {
    console.log("No garbage domains found — nothing to do.");
    return;
  }

  for (const d of matched) {
    if (d._count.categories > 0) {
      console.log(
        `SKIP (has ${d._count.categories} categories): ${d.name} [${d.id}] — use force delete in UI`,
      );
      continue;
    }
    await prisma.materialDomain.delete({ where: { id: d.id } });
    console.log(`DELETED empty domain: ${d.name} [${d.id}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
