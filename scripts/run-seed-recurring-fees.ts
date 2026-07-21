import { prisma } from "../src/lib/prisma";
import { seedRecurringFees } from "./seed-recurring-fees";

async function main() {
  await seedRecurringFees(prisma);
  const n = await prisma.recurringFeeItem.count();
  console.log(`Seeded recurring fee items: ${n} row(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
