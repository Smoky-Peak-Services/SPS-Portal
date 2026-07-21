import { prisma } from "../src/lib/prisma";
import { seedServicePlans } from "./seed-service-plans";

async function main() {
  await seedServicePlans(prisma);
  const n = await prisma.servicePlanRate.count();
  console.log(`Seeded service plan rates: ${n} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
