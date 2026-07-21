import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { LaborScopeSeed } from "../src/features/pricing/labor-seed-types";
import {
  IS_COM_LABOR_MULTIPLIERS,
  IS_COM_LABOR_POSITIONS,
} from "../src/features/pricing/is-com-rates";
import {
  IS_RES_LABOR_MULTIPLIERS,
  IS_RES_LABOR_POSITIONS,
} from "../src/features/pricing/is-res-rates";
import {
  CABIN_LABOR_MULTIPLIERS,
  CABIN_LABOR_POSITIONS,
} from "../src/features/pricing/cabin-rates";

const LABOR_SCOPE_SEEDS: LaborScopeSeed[] = [
  {
    divisionSlug: "integrated-systems",
    segment: "COMMERCIAL",
    multipliers: IS_COM_LABOR_MULTIPLIERS,
    positions: IS_COM_LABOR_POSITIONS,
  },
  {
    divisionSlug: "integrated-systems",
    segment: "RESIDENTIAL",
    multipliers: IS_RES_LABOR_MULTIPLIERS,
    positions: IS_RES_LABOR_POSITIONS,
  },
  {
    divisionSlug: "cabin-services",
    segment: "STR",
    multipliers: CABIN_LABOR_MULTIPLIERS,
    positions: CABIN_LABOR_POSITIONS,
  },
];

const toDecimal = (n: number) => new Prisma.Decimal(n);
const toNullableDecimal = (n: number | null) =>
  n == null ? null : new Prisma.Decimal(n);

/**
 * Upsert labor rate config + positions for all three scopes
 * (IS-Commercial, IS-Residential, Cabin Services).
 */
export async function seedLaborRates(prisma: PrismaClient): Promise<void> {
  for (const scope of LABOR_SCOPE_SEEDS) {
    const division = await prisma.division.findUnique({
      where: { slug: scope.divisionSlug },
      select: { id: true },
    });
    if (!division) {
      throw new Error(
        `Division "${scope.divisionSlug}" not found — seed divisions first`,
      );
    }

    const configData = {
      burdenMultiplier: toDecimal(scope.multipliers.burdenMultiplier),
      standardBillingMultiplier: toDecimal(
        scope.multipliers.standardBillingMultiplier,
      ),
      afterHoursMultiplier: toDecimal(scope.multipliers.afterHoursMultiplier),
      holidayMultiplier: toDecimal(scope.multipliers.holidayMultiplier),
      discountedMultiplier: toNullableDecimal(
        scope.multipliers.discountedMultiplier,
      ),
    };

    await prisma.laborRateConfig.upsert({
      where: {
        divisionId_segment: {
          divisionId: division.id,
          segment: scope.segment,
        },
      },
      create: {
        divisionId: division.id,
        segment: scope.segment,
        ...configData,
      },
      update: configData,
    });

    for (const p of scope.positions) {
      const positionData = {
        title: p.title,
        baseHourlyRate: toDecimal(p.baseHourlyRate),
        actualCostOfLabor: toDecimal(p.actualCostOfLabor),
        standardBillingRate: toDecimal(p.standardBillingRate),
        afterHoursRate: toDecimal(p.afterHoursRate),
        holidayRate: toDecimal(p.holidayRate),
        discountedRate: toNullableDecimal(p.discountedRate),
        quotedAllocationPct: toDecimal(p.quotedAllocationPct),
        context: p.context,
        sortOrder: p.sortOrder,
      };
      await prisma.laborPosition.upsert({
        where: {
          divisionId_segment_sku: {
            divisionId: division.id,
            segment: scope.segment,
            sku: p.sku,
          },
        },
        create: {
          divisionId: division.id,
          segment: scope.segment,
          sku: p.sku,
          ...positionData,
        },
        update: positionData,
      });
    }
  }
}
