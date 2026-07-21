import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { IS_COM_COMPLEXITY_MULTIPLIERS } from "../src/features/pricing/is-com-complexity";

/**
 * Upsert IS-Commercial complexity multipliers (10 rows).
 * Scope resolved by division slug — not hardcoded into the schema.
 */
export async function seedComplexityMultipliers(
  prisma: PrismaClient,
): Promise<void> {
  const division = await prisma.division.findUnique({
    where: { slug: "integrated-systems" },
    select: { id: true },
  });
  if (!division) {
    throw new Error(
      'Division "integrated-systems" not found — seed divisions first',
    );
  }

  const segment = "COMMERCIAL" as const;

  for (const row of IS_COM_COMPLEXITY_MULTIPLIERS) {
    await prisma.complexityMultiplier.upsert({
      where: {
        divisionId_segment_slug: {
          divisionId: division.id,
          segment,
          slug: row.slug,
        },
      },
      create: {
        divisionId: division.id,
        segment,
        name: row.name,
        slug: row.slug,
        category: row.category,
        modificationRate: new Prisma.Decimal(row.modificationRate),
        description: row.description,
        isActive: true,
        sortOrder: row.sortOrder,
      },
      update: {
        name: row.name,
        category: row.category,
        modificationRate: new Prisma.Decimal(row.modificationRate),
        description: row.description,
        sortOrder: row.sortOrder,
      },
    });
  }
}
