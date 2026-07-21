import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { CABIN_SERVICE_PLANS } from "../src/features/pricing/cabin-service-plans";

/**
 * Upsert Cabin Services plan rates (prompt 14): Maintenance, Inspection, and
 * Full-Service tabs from cabin-services-master-rate-sheet.xlsx, 18 rows.
 * Cabin is the only division with ServicePlanRate rows today.
 */
export async function seedServicePlans(prisma: PrismaClient): Promise<void> {
  const division = await prisma.division.findUnique({
    where: { slug: "cabin-services" },
    select: { id: true },
  });
  if (!division) {
    throw new Error(
      'Division "cabin-services" not found — seed divisions first',
    );
  }

  const segment = "STR" as const;

  for (const row of CABIN_SERVICE_PLANS) {
    await prisma.servicePlanRate.upsert({
      where: {
        divisionId_segment_sku: {
          divisionId: division.id,
          segment,
          sku: row.sku,
        },
      },
      create: {
        divisionId: division.id,
        segment,
        planType: row.planType,
        sku: row.sku,
        description: row.description,
        bedrooms: row.bedrooms,
        maxBathrooms: row.maxBathrooms,
        rate: row.rate === null ? null : new Prisma.Decimal(row.rate),
        isCustomQuote: row.isCustomQuote,
        isActive: true,
        sortOrder: row.sortOrder,
      },
      update: {
        planType: row.planType,
        description: row.description,
        bedrooms: row.bedrooms,
        maxBathrooms: row.maxBathrooms,
        rate: row.rate === null ? null : new Prisma.Decimal(row.rate),
        isCustomQuote: row.isCustomQuote,
        sortOrder: row.sortOrder,
      },
    });
  }
}
