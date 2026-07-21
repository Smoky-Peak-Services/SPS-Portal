"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertCapability,
  requireArea,
  type SessionUser,
} from "@/lib/session";
import {
  updateLaborPositionSchema,
  updateLaborRateConfigSchema,
} from "./admin-schemas";

function assertPricingWrite(user: SessionUser) {
  assertCapability(user, "pricing.write");
}

function revalidateLaborRates() {
  revalidatePath("/pricing/labor-rates");
}

export async function listLaborRateScopes() {
  await requireArea("pricing");
  const divisions = await prisma.division.findMany({
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
