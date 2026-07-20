/**
 * Ensure manufacturer + part_number attributes exist and are assigned
 * on every material category (ops DB).
 *
 * Usage: npm run ensure:core-assignments
 */
import { prisma } from "../src/lib/prisma";
import { ensureCoreAssignmentsForAllCategories } from "../src/features/materials/ensure-core-assignments";

async function main() {
  console.log("Ensuring core category attribute assignments…");
  const result = await ensureCoreAssignmentsForAllCategories(prisma);
  console.log(
    `  ✓ ${result.categoriesUpdated} categories; manufacturer=${result.manufacturerId}; part_number=${result.partNumberId}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
