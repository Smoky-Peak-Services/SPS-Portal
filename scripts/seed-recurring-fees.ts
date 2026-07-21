import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { IS_COM_RECURRING_FEES } from "../src/features/pricing/is-com-recurring";

/**
 * Upsert IS-Commercial recurring fee catalog (10 rows).
 * No $18.99 monitoring; BOH money columns are zero placeholders.
 */
export async function seedRecurringFees(prisma: PrismaClient): Promise<void> {
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

  for (const row of IS_COM_RECURRING_FEES) {
    await prisma.recurringFeeItem.upsert({
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
        sku: row.sku,
        description: row.description,
        unit: row.unit,
        baseCost: new Prisma.Decimal(row.baseCost),
        directPurchaseRate: new Prisma.Decimal(row.directPurchaseRate),
        smaBundledRate: new Prisma.Decimal(row.smaBundledRate),
        billingCycle: row.billingCycle,
        feeType: row.feeType,
        valueType: row.valueType,
        systemValueMin:
          row.systemValueMin == null
            ? null
            : new Prisma.Decimal(row.systemValueMin),
        systemValueMax:
          row.systemValueMax == null
            ? null
            : new Prisma.Decimal(row.systemValueMax),
        notes: row.notes,
        isActive: true,
        sortOrder: row.sortOrder,
      },
      update: {
        description: row.description,
        unit: row.unit,
        baseCost: new Prisma.Decimal(row.baseCost),
        directPurchaseRate: new Prisma.Decimal(row.directPurchaseRate),
        smaBundledRate: new Prisma.Decimal(row.smaBundledRate),
        billingCycle: row.billingCycle,
        feeType: row.feeType,
        valueType: row.valueType,
        systemValueMin:
          row.systemValueMin == null
            ? null
            : new Prisma.Decimal(row.systemValueMin),
        systemValueMax:
          row.systemValueMax == null
            ? null
            : new Prisma.Decimal(row.systemValueMax),
        notes: row.notes,
        sortOrder: row.sortOrder,
      },
    });
  }
}
