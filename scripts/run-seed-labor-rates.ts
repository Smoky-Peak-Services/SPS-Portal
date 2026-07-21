import { prisma } from "../src/lib/prisma";
import { seedLaborRates } from "./seed-labor-rates";

async function main() {
  await seedLaborRates(prisma);
  const configs = await prisma.laborRateConfig.count();
  const positions = await prisma.laborPosition.count();
  console.log(
    `Seeded labor rates: ${configs} config(s), ${positions} position(s)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
