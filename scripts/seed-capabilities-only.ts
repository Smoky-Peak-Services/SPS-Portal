import { prisma } from "../src/lib/prisma";
import { seedCapabilities } from "../src/config/capabilities";

async function main() {
  await seedCapabilities(prisma);
  console.log("Capabilities seeded (including pricing.access / pricing.write)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
