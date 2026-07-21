import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  IS_COM_LABOR_MULTIPLIERS,
  IS_COM_LABOR_POSITIONS,
} from "../src/features/pricing/is-com-rates";

/**
 * Upsert IS-Commercial labor rate config + 5 positions.
 * Scope is resolved by division slug — not hardcoded into the schema.
 */
export async function seedLaborRates(prisma: PrismaClient): Promise<void> {
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

  await prisma.laborRateConfig.upsert({
    where: {
      divisionId_segment: { divisionId: division.id, segment },
    },
    create: {
      divisionId: division.id,
      segment,
      burdenMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.burdenMultiplier,
      ),
      commercialBillingMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.commercialBillingMultiplier,
      ),
      afterHoursMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.afterHoursMultiplier,
      ),
      holidayMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.holidayMultiplier,
      ),
    },
    update: {
      burdenMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.burdenMultiplier,
      ),
      commercialBillingMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.commercialBillingMultiplier,
      ),
      afterHoursMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.afterHoursMultiplier,
      ),
      holidayMultiplier: new Prisma.Decimal(
        IS_COM_LABOR_MULTIPLIERS.holidayMultiplier,
      ),
    },
  });

  for (const p of IS_COM_LABOR_POSITIONS) {
    await prisma.laborPosition.upsert({
      where: {
        divisionId_segment_sku: {
          divisionId: division.id,
          segment,
          sku: p.sku,
        },
      },
      create: {
        divisionId: division.id,
        segment,
        title: p.title,
        sku: p.sku,
        baseHourlyRate: new Prisma.Decimal(p.baseHourlyRate),
        actualCostOfLabor: new Prisma.Decimal(p.actualCostOfLabor),
        standardBillingRate: new Prisma.Decimal(p.standardBillingRate),
        afterHoursRate: new Prisma.Decimal(p.afterHoursRate),
        holidayRate: new Prisma.Decimal(p.holidayRate),
        quotedAllocationPct: new Prisma.Decimal(p.quotedAllocationPct),
        context: p.context,
        sortOrder: p.sortOrder,
      },
      update: {
        title: p.title,
        baseHourlyRate: new Prisma.Decimal(p.baseHourlyRate),
        actualCostOfLabor: new Prisma.Decimal(p.actualCostOfLabor),
        standardBillingRate: new Prisma.Decimal(p.standardBillingRate),
        afterHoursRate: new Prisma.Decimal(p.afterHoursRate),
        holidayRate: new Prisma.Decimal(p.holidayRate),
        quotedAllocationPct: new Prisma.Decimal(p.quotedAllocationPct),
        context: p.context,
        sortOrder: p.sortOrder,
      },
    });
  }
}
