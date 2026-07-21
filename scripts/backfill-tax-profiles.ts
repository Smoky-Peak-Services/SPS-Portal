/**
 * Recompute MaterialCategory.taxProfile from stripeTaxCodeId
 * (nontaxable/null → REAL_PROPERTY; else TPP). Clear item taxProfile overrides.
 *
 * Usage: npm run backfill:tax-profiles
 */
import { prisma } from "../src/lib/prisma";
import { deriveTaxProfileFromStripeCode } from "../src/features/materials/tax";

async function main() {
  console.log("Backfilling category tax profiles from Stripe tax codes…");
  const categories = await prisma.materialCategory.findMany({
    select: { id: true, stripeTaxCodeId: true, taxProfile: true },
  });

  let categoriesUpdated = 0;
  for (const cat of categories) {
    const next = deriveTaxProfileFromStripeCode(cat.stripeTaxCodeId);
    if (cat.taxProfile !== next) {
      await prisma.materialCategory.update({
        where: { id: cat.id },
        data: { taxProfile: next },
      });
      categoriesUpdated += 1;
    }
  }

  const itemsCleared = await prisma.materialItem.updateMany({
    where: { taxProfile: { not: null } },
    data: { taxProfile: null },
  });

  console.log(
    `  ✓ ${categoriesUpdated}/${categories.length} categories updated; ${itemsCleared.count} item taxProfile overrides cleared`,
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
