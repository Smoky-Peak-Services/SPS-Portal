import { prisma } from "../src/lib/prisma";
import { seedConsumables } from "./seed-consumables";

async function main() {
  await seedConsumables(prisma);
  const n = await prisma.consumableItem.count();
  console.log(`Seeded consumable items: ${n} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
