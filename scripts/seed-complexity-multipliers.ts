import type { PrismaClient, Segment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { ComplexitySeed } from "../src/features/pricing/complexity-seed-types";
import { IS_COM_COMPLEXITY_MULTIPLIERS } from "../src/features/pricing/is-com-complexity";
import { IS_RES_COMPLEXITY_MULTIPLIERS } from "../src/features/pricing/is-res-complexity";
import { CABIN_COMPLEXITY_MULTIPLIERS } from "../src/features/pricing/cabin-complexity";

type ComplexityScopeSeed = {
  divisionSlug: string;
  segment: Segment;
  rows: ComplexitySeed[];
};

/**
 * All three scopes from the master rate workbooks (prompt 14):
 * IS-Commercial 10 rows, IS-Residential 16 rows, Cabin Services 20 rows.
 */
const COMPLEXITY_SCOPE_SEEDS: ComplexityScopeSeed[] = [
  {
    divisionSlug: "integrated-systems",
    segment: "COMMERCIAL",
    rows: IS_COM_COMPLEXITY_MULTIPLIERS,
  },
  {
    divisionSlug: "integrated-systems",
    segment: "RESIDENTIAL",
    rows: IS_RES_COMPLEXITY_MULTIPLIERS,
  },
  {
    divisionSlug: "cabin-services",
    segment: "STR",
    rows: CABIN_COMPLEXITY_MULTIPLIERS,
  },
];

/** Upsert complexity multipliers for every scope. */
export async function seedComplexityMultipliers(
  prisma: PrismaClient,
): Promise<void> {
  for (const scope of COMPLEXITY_SCOPE_SEEDS) {
    const division = await prisma.division.findUnique({
      where: { slug: scope.divisionSlug },
      select: { id: true },
    });
    if (!division) {
      throw new Error(
        `Division "${scope.divisionSlug}" not found — seed divisions first`,
      );
    }

    for (const row of scope.rows) {
      await prisma.complexityMultiplier.upsert({
        where: {
          divisionId_segment_slug: {
            divisionId: division.id,
            segment: scope.segment,
            slug: row.slug,
          },
        },
        create: {
          divisionId: division.id,
          segment: scope.segment,
          name: row.name,
          slug: row.slug,
          category: row.category,
          multiplierType: row.multiplierType,
          appliedTo: row.appliedTo,
          value: new Prisma.Decimal(row.value),
          description: row.description,
          isActive: true,
          sortOrder: row.sortOrder,
        },
        update: {
          name: row.name,
          category: row.category,
          multiplierType: row.multiplierType,
          appliedTo: row.appliedTo,
          value: new Prisma.Decimal(row.value),
          description: row.description,
          sortOrder: row.sortOrder,
        },
      });
    }
  }
}
