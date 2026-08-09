"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveScope } from "@/features/materials/scope";
import { assertCapability, requireArea, type SessionUser } from "@/lib/session";
import { recomputeRates, type LaborRateMultipliers } from "./recompute";
import { installAllocationSumOk } from "./allocation-sum";
import { smaTierOverlapError } from "./sma-overlap";
import {
  createRecurringFeeItemSchema,
  deleteRecurringFeeItemSchema,
  unitForBillingCycle,
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
  const { segment: scopedSegment } = resolveScope(division.slug, segment);
  const [config, positions] = await Promise.all([
    prisma.laborRateConfig.findUnique({
      where: {
        divisionId_segment: { divisionId, segment: scopedSegment },
      },
    }),
    prisma.laborPosition.findMany({
      where: { divisionId, segment: scopedSegment },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);
  return { config, positions, division };
}

/**
 * Base + multipliers are authoritative (prompt 16): the derived rate columns
 * on LaborPosition are a materialized cache written only through these two
 * helpers, always from recomputeRates — never from client input.
 */
function multipliersFromConfig(config: {
  burdenMultiplier: Prisma.Decimal;
  standardBillingMultiplier: Prisma.Decimal;
  afterHoursMultiplier: Prisma.Decimal;
  holidayMultiplier: Prisma.Decimal;
  discountedMultiplier: Prisma.Decimal | null;
}): LaborRateMultipliers {
  return {
    burdenMultiplier: Number(config.burdenMultiplier),
    standardBillingMultiplier: Number(config.standardBillingMultiplier),
    afterHoursMultiplier: Number(config.afterHoursMultiplier),
    holidayMultiplier: Number(config.holidayMultiplier),
    discountedMultiplier:
      config.discountedMultiplier == null
        ? null
        : Number(config.discountedMultiplier),
  };
}

function derivedRateData(
  multipliers: LaborRateMultipliers,
  baseHourlyRate: number,
) {
  const derived = recomputeRates(multipliers, baseHourlyRate);
  return {
    actualCostOfLabor: new Prisma.Decimal(derived.actualCostOfLabor),
    standardBillingRate: new Prisma.Decimal(derived.standardBillingRate),
    afterHoursRate: new Prisma.Decimal(derived.afterHoursRate),
    holidayRate: new Prisma.Decimal(derived.holidayRate),
    discountedRate:
      derived.discountedRate == null
        ? null
        : new Prisma.Decimal(derived.discountedRate),
  };
}

export async function updateLaborRateConfig(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateLaborRateConfigSchema.parse(raw);

  await prisma.$transaction(async (tx) => {
    const config = await tx.laborRateConfig.update({
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

    const multipliers = multipliersFromConfig(config);
    const positions = await tx.laborPosition.findMany({
      where: { divisionId: config.divisionId, segment: config.segment },
      select: { id: true, baseHourlyRate: true },
    });
    for (const p of positions) {
      await tx.laborPosition.update({
        where: { id: p.id },
        data: derivedRateData(multipliers, Number(p.baseHourlyRate)),
      });
    }
  });

  revalidateLaborRates();
  return { ok: true as const };
}

export async function updateLaborPosition(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateLaborPositionSchema.parse(raw);

  const position = await prisma.laborPosition.findUnique({
    where: { id: data.id },
    select: { divisionId: true, segment: true },
  });
  if (!position) {
    return { ok: false as const, error: "Position not found" };
  }
  const config = await prisma.laborRateConfig.findUnique({
    where: {
      divisionId_segment: {
        divisionId: position.divisionId,
        segment: position.segment,
      },
    },
  });
  if (!config) {
    return {
      ok: false as const,
      error:
        "No labor rate config for this scope — seed it before editing positions",
    };
  }

  const siblings = await prisma.laborPosition.findMany({
    where: {
      divisionId: position.divisionId,
      segment: position.segment,
    },
    select: { id: true, context: true, quotedAllocationPct: true },
  });
  const allocCheck = installAllocationSumOk(
    siblings.map((s) => ({
      id: s.id,
      context: s.context,
      quotedAllocationPct: Number(s.quotedAllocationPct),
    })),
    { id: data.id, quotedAllocationPct: data.quotedAllocationPct },
  );
  if (!allocCheck.ok) {
    return {
      ok: false as const,
      error: `INSTALL quotedAllocationPct must sum to 100 (would be ${allocCheck.sum})`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.laborPosition.update({
      where: { id: data.id },
      data: {
        title: data.title,
        baseHourlyRate: new Prisma.Decimal(data.baseHourlyRate),
        ...derivedRateData(multipliersFromConfig(config), data.baseHourlyRate),
        quotedAllocationPct: new Prisma.Decimal(data.quotedAllocationPct),
        sortOrder: data.sortOrder,
      },
    });
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
  const { segment: scopedSegment } = resolveScope(division.slug, segment);
  const multipliers = await prisma.complexityMultiplier.findMany({
    where: { divisionId, segment: scopedSegment },
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
  const { segment: scopedSegment } = resolveScope(division.slug, segment);
  const items = await prisma.recurringFeeItem.findMany({
    where: { divisionId, segment: scopedSegment },
    orderBy: [{ sortOrder: "asc" }, { sku: "asc" }],
  });
  return { items, division };
}

function toNullableDecimal(v: number | null | undefined) {
  if (v === undefined || v === null) return null;
  return new Prisma.Decimal(v);
}

function recurringFeeMoneyData(data: {
  baseCost: number;
  directPurchaseRate: number;
  smaBundledRate: number;
  systemValueMin?: number | null;
  systemValueMax?: number | null;
}) {
  return {
    baseCost: new Prisma.Decimal(data.baseCost),
    directPurchaseRate: new Prisma.Decimal(data.directPurchaseRate),
    smaBundledRate: new Prisma.Decimal(data.smaBundledRate),
    systemValueMin: toNullableDecimal(data.systemValueMin ?? null),
    systemValueMax: toNullableDecimal(data.systemValueMax ?? null),
  };
}

async function assertSmaTierNoOverlap(args: {
  divisionId: string;
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR";
  candidate: {
    id?: string;
    sku: string;
    feeType: string;
    systemValueMin?: number | null;
    systemValueMax?: number | null;
  };
}) {
  if (args.candidate.feeType !== "SMA_BASE_TIER") return;
  const existing = await prisma.recurringFeeItem.findMany({
    where: {
      divisionId: args.divisionId,
      segment: args.segment,
      feeType: "SMA_BASE_TIER",
    },
    select: {
      id: true,
      sku: true,
      systemValueMin: true,
      systemValueMax: true,
    },
  });
  const err = smaTierOverlapError(
    {
      id: args.candidate.id,
      sku: args.candidate.sku,
      systemValueMin: args.candidate.systemValueMin ?? null,
      systemValueMax: args.candidate.systemValueMax ?? null,
    },
    existing.map((t) => ({
      id: t.id,
      sku: t.sku,
      systemValueMin:
        t.systemValueMin == null ? null : Number(t.systemValueMin),
      systemValueMax:
        t.systemValueMax == null ? null : Number(t.systemValueMax),
    })),
  );
  if (err) throw new Error(err);
}

function recurringUniqueError(err: unknown, sku: string): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const target = err.meta?.target;
    const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
    if (fields.includes("svm") || fields.includes("feeType")) {
      throw new Error(
        "This scope already has an SMA SVM row — only one SVM percent is allowed",
      );
    }
    throw new Error(
      `SKU "${sku}" already exists in this scope — pick a unique SKU`,
    );
  }
  throw err;
}

export async function createRecurringFeeItem(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = createRecurringFeeItemSchema.parse(raw);

  const division = await prisma.division.findUnique({
    where: { id: data.divisionId },
    select: { id: true, slug: true },
  });
  if (!division) {
    throw new Error("Division not found");
  }
  const { segment: scopedSegment } = resolveScope(division.slug, data.segment);

  await assertSmaTierNoOverlap({
    divisionId: division.id,
    segment: scopedSegment,
    candidate: data,
  });

  try {
    await prisma.recurringFeeItem.create({
      data: {
        divisionId: division.id,
        segment: scopedSegment,
        sku: data.sku,
        description: data.description,
        unit: unitForBillingCycle(data.billingCycle),
        billingCycle: data.billingCycle,
        feeType: data.feeType,
        valueType: data.valueType,
        notes: data.notes,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        ...recurringFeeMoneyData(data),
      },
    });
  } catch (err) {
    recurringUniqueError(err, data.sku);
  }

  revalidateRecurring();
  return { ok: true as const };
}

export async function updateRecurringFeeItem(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = updateRecurringFeeItemSchema.parse(raw);

  const existing = await prisma.recurringFeeItem.findUnique({
    where: { id: data.id },
    select: { divisionId: true, segment: true },
  });
  if (!existing) throw new Error("Recurring fee not found");

  await assertSmaTierNoOverlap({
    divisionId: existing.divisionId,
    segment: existing.segment,
    candidate: { ...data, id: data.id },
  });

  try {
    await prisma.recurringFeeItem.update({
      where: { id: data.id },
      data: {
        sku: data.sku,
        description: data.description,
        unit: unitForBillingCycle(data.billingCycle),
        billingCycle: data.billingCycle,
        feeType: data.feeType,
        valueType: data.valueType,
        notes: data.notes,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        ...recurringFeeMoneyData(data),
      },
    });
  } catch (err) {
    recurringUniqueError(err, data.sku);
  }

  revalidateRecurring();
  return { ok: true as const };
}

export async function deleteRecurringFeeItem(raw: unknown) {
  const user = await requireArea("pricing");
  assertPricingWrite(user);
  const data = deleteRecurringFeeItemSchema.parse(raw);
  await prisma.recurringFeeItem.delete({ where: { id: data.id } });
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
  const { segment: scopedSegment } = resolveScope(division.slug, segment);
  const plans = await prisma.servicePlanRate.findMany({
    where: { divisionId, segment: scopedSegment },
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
