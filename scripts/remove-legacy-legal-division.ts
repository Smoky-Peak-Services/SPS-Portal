/**
 * One-shot: remove legacy legal-entity Division row (smoky-peak-services)
 * if it has no catalog/pricing children.
 */
import { prisma } from "../src/lib/prisma";
import { isPiiConfigured, prismaPii } from "../src/lib/prisma-pii";

async function main() {
  const legacy = await prisma.division.findUnique({
    where: { slug: "smoky-peak-services" },
    include: {
      _count: {
        select: {
          materialDomains: true,
          laborRateConfigs: true,
          laborPositions: true,
          complexityMultipliers: true,
          recurringFeeItems: true,
        },
      },
    },
  });
  if (!legacy) {
    console.log("No smoky-peak-services division — nothing to do.");
    return;
  }
  const c = legacy._count;
  const hasCatalog =
    c.materialDomains +
      c.laborRateConfigs +
      c.laborPositions +
      c.complexityMultipliers +
      c.recurringFeeItems >
    0;
  if (hasCatalog) {
    throw new Error("smoky-peak-services still has catalog/pricing rows");
  }
  await prisma.divisionMembership.deleteMany({
    where: { divisionId: legacy.id },
  });
  await prisma.division.delete({ where: { id: legacy.id } });
  if (isPiiConfigured()) {
    await prismaPii.ingestKey.deleteMany({ where: { divisionId: legacy.id } });
    await prismaPii.division.deleteMany({ where: { id: legacy.id } });
  }
  console.log("Removed smoky-peak-services division.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
