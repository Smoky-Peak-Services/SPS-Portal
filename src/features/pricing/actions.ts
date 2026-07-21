"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operationalDivisionSlugs } from "@/config/company";
import {
  assertCapability,
  requireArea,
  type SessionUser,
} from "@/lib/session";
import {
  updateComplexityMultiplierSchema,
  updateLaborPositionSchema,
  updateLaborRateConfigSchema,
  updateRecurringFeeItemSchema,
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
  revalidatePath("/pricing/recurring");
}

export async function listLaborRateScopes() {
  await requireArea("pricing");
  const divisions = await prisma.division.findMany({
    where: { slug: { in: [...operationalDivisionSlugs()] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  const configs = await prisma.laborRateConfig.findMany({
    select: { divisionId: true, segment: true },
  });
  return { divisions, configs };
}

export async function getLaborRatesForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const [config, positions, division] = await Promise.all([
    prisma.laborRateConfig.findUnique({
      where: { divisionId_segment: { divisionId, segment } },
    }),
    prisma.laborPosition.findMany({
      where: { divisionId, segment },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true, name: true, slug: true },
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
      commercialBillingMultiplier: new Prisma.Decimal(
        data.commercialBillingMultiplier,
      ),
      afterHoursMultiplier: new Prisma.Decimal(data.afterHoursMultiplier),
      holidayMultiplier: new Prisma.Decimal(data.holidayMultiplier),
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
      quotedAllocationPct: new Prisma.Decimal(data.quotedAllocationPct),
      sortOrder: data.sortOrder,
    },
  });
  revalidateLaborRates();
  return { ok: true as const };
}

export async function listComplexityScopes() {
  await requireArea("pricing");
  const divisions = await prisma.division.findMany({
    where: { slug: { in: [...operationalDivisionSlugs()] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  const scopes = await prisma.complexityMultiplier.findMany({
    distinct: ["divisionId", "segment"],
    select: { divisionId: true, segment: true },
  });
  return { divisions, scopes };
}

export async function getComplexityForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const [multipliers, division] = await Promise.all([
    prisma.complexityMultiplier.findMany({
      where: { divisionId, segment },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true, name: true, slug: true },
    }),
  ]);
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
      modificationRate: new Prisma.Decimal(data.modificationRate),
      description: data.description,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  revalidateComplexity();
  return { ok: true as const };
}

export async function listRecurringScopes() {
  await requireArea("pricing");
  const divisions = await prisma.division.findMany({
    where: { slug: { in: [...operationalDivisionSlugs()] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  const scopes = await prisma.recurringFeeItem.findMany({
    distinct: ["divisionId", "segment"],
    select: { divisionId: true, segment: true },
  });
  return { divisions, scopes };
}

export async function getRecurringForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("pricing");
  const [items, division] = await Promise.all([
    prisma.recurringFeeItem.findMany({
      where: { divisionId, segment },
      orderBy: [{ sortOrder: "asc" }, { sku: "asc" }],
    }),
    prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true, name: true, slug: true },
    }),
  ]);
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
