"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveStorageScope } from "@/features/materials/scope";
import { assertCapability, requireArea, type SessionUser } from "@/lib/session";
import {
  updateComplexityMultiplierSchema,
  updateLaborPositionSchema,
  updateLaborRateConfigSchema,
  updateRecurringFeeItemSchema,
  updateServicePlanRateSchema,
} from "./admin-schemas";

function assertPricingWrite(user: SessionUser) {
  assertCapability(user, "pricing.write");
}

function revalidateLaborRates() {
  revalidatePath("/pricing/labor-rates");
}

function revalidateComplexity() {
  revalidatePath("/pricing/complexity");
}

function revalidateRecurring() {
  revalidatePath("/materials/recurring");
}

export async function getLaborRatesForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, name: true, slug: true },
  });
  if (!division) {
    return { config: null, positions: [], division: null };
  }
  const { storageSegment } = resolveStorageScope(division.slug, segment);
  const [config, positions] = await Promise.all([
    prisma.laborRateConfig.findUnique({
      where: {
        divisionId_segment: { divisionId, segment: storageSegment },
      },
    }),
    prisma.laborPosition.findMany({
      where: { divisionId, segment: storageSegment },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);
  return { config, positions, division };
}

export async function updateLaborRateConfig(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateLaborRateConfigSchema.parse(raw);
  await prisma.laborRateConfig.update({
    where: { id: data.id },
    data: {
      burdenMultiplier: new Prisma.Decimal(data.burdenMultiplier),
      standardBillingMultiplier: new Prisma.Decimal(
        data.standardBillingMultiplier,
      ),
      afterHoursMultiplier: new Prisma.Decimal(data.afterHoursMultiplier),
      holidayMultiplier: new Prisma.Decimal(data.holidayMultiplier),
      ...(data.discountedMultiplier !== undefined
        ? {
            discountedMultiplier:
              data.discountedMultiplier === null
                ? null
                : new Prisma.Decimal(data.discountedMultiplier),
          }
        : {}),
    },
  });
  revalidateLaborRates();
  return { ok: true as const };
}

export async function updateLaborPosition(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateLaborPositionSchema.parse(raw);
  await prisma.laborPosition.update({
    where: { id: data.id },
    data: {
      title: data.title,
      baseHourlyRate: new Prisma.Decimal(data.baseHourlyRate),
      actualCostOfLabor: new Prisma.Decimal(data.actualCostOfLabor),
      standardBillingRate: new Prisma.Decimal(data.standardBillingRate),
      afterHoursRate: new Prisma.Decimal(data.afterHoursRate),
      holidayRate: new Prisma.Decimal(data.holidayRate),
      ...(data.discountedRate !== undefined
        ? {
            discountedRate:
              data.discountedRate === null
                ? null
                : new Prisma.Decimal(data.discountedRate),
          }
        : {}),
      quotedAllocationPct: new Prisma.Decimal(data.quotedAllocationPct),
      sortOrder: data.sortOrder,
    },
  });
  revalidateLaborRates();
  return { ok: true as const };
}

export async function getComplexityForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, name: true, slug: true },
  });
  if (!division) {
    return { multipliers: [], division: null };
  }
  const { storageSegment } = resolveStorageScope(division.slug, segment);
  const multipliers = await prisma.complexityMultiplier.findMany({
    where: { divisionId, segment: storageSegment },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return { multipliers, division };
}

export async function updateComplexityMultiplier(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateComplexityMultiplierSchema.parse(raw);
  await prisma.complexityMultiplier.update({
    where: { id: data.id },
    data: {
      name: data.name,
      category: data.category,
      multiplierType: data.multiplierType,
      appliedTo: data.appliedTo,
      value: new Prisma.Decimal(data.value),
      description: data.description,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  revalidateComplexity();
  return { ok: true as const };
}

export async function getRecurringForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, name: true, slug: true },
  });
  if (!division) {
    return { items: [], division: null };
  }
  const { storageSegment } = resolveStorageScope(division.slug, segment);
  const items = await prisma.recurringFeeItem.findMany({
    where: { divisionId, segment: storageSegment },
    orderBy: [{ sortOrder: "asc" }, { sku: "asc" }],
  });
  return { items, division };
}

export async function updateRecurringFeeItem(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateRecurringFeeItemSchema.parse(raw);

  const toNullableDecimal = (v: number | null | undefined) => {
    if (v === undefined || v === null) return null;
    return new Prisma.Decimal(v);
  };

  await prisma.recurringFeeItem.update({
    where: { id: data.id },
    data: {
      description: data.description,
      baseCost: new Prisma.Decimal(data.baseCost),
      directPurchaseRate: new Prisma.Decimal(data.directPurchaseRate),
      smaBundledRate: new Prisma.Decimal(data.smaBundledRate),
      notes: data.notes,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      ...(data.systemValueMin !== undefined
        ? { systemValueMin: toNullableDecimal(data.systemValueMin) }
        : {}),
      ...(data.systemValueMax !== undefined
        ? { systemValueMax: toNullableDecimal(data.systemValueMax) }
        : {}),
    },
  });
  revalidateRecurring();
  return { ok: true as const };
}

export async function getServicePlansForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { id: true, name: true, slug: true },
  });
  if (!division) {
    return { plans: [], division: null };
  }
  const { storageSegment } = resolveStorageScope(division.slug, segment);
  const plans = await prisma.servicePlanRate.findMany({
    where: { divisionId, segment: storageSegment },
    orderBy: [{ planType: "asc" }, { sortOrder: "asc" }, { sku: "asc" }],
  });
  return { plans, division };
}

export async function updateServicePlanRate(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateServicePlanRateSchema.parse(raw);
  const existing = await prisma.servicePlanRate.findUnique({
    where: { id: data.id },
    select: { isCustomQuote: true },
  });
  if (!existing) {
    throw new Error("Service plan row not found");
  }
  if (
    !existing.isCustomQuote &&
    (data.rate === null || data.rate === undefined)
  ) {
    throw new Error(
      "Standard plan rows require a rate; only custom-quote rows are quoted",
    );
  }
  await prisma.servicePlanRate.update({
    where: { id: data.id },
    data: {
      rate:
        data.rate === null || data.rate === undefined
          ? null
          : new Prisma.Decimal(data.rate),
      isActive: data.isActive,
    },
  });
  revalidateRecurring();
  return { ok: true as const };
}
