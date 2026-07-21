import { prisma } from "../src/lib/prisma";
import { seedComplexityMultipliers } from "./seed-complexity-multipliers";

async function main() {
  await seedComplexityMultipliers(prisma);
  const n = await prisma.complexityMultiplier.count();
  console.log(`Seeded complexity multipliers: ${n} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
