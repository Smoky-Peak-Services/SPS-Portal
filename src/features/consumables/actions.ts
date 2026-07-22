"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireArea, assertCapability, type SessionUser } from "@/lib/session";
import {
  blendedInstallRate,
  positionsToQuotedInput,
} from "@/features/pricing/blended-rate";
import {
  createConsumableSchema,
  deleteConsumableSchema,
  updateConsumableSchema,
} from "./schemas";

function assertCatalogWrite(user: SessionUser) {
  assertCapability(user, "materials.catalog.write");
}

function assertDelete(user: SessionUser) {
  assertCapability(user, "materials.delete");
}

function revalidateConsumables() {
  revalidatePath("/materials/consumables");
}

function toNullableDecimal(v: number | null | undefined) {
  if (v === undefined || v === null) return null;
  return new Prisma.Decimal(v);
}

function consumableWriteData(data: {
  description: string;
  sku: string;
  category?: string | null;
  manufacturer?: string | null;
  partNumber?: string | null;
  unit: string;
  wasteFactorPct: number;
  baseCost?: number | null;
  isMarketRate: boolean;
  markupPct: number;
  laborUnits: number;
  supplier?: string | null;
  notes?: string | null;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    description: data.description,
    sku: data.sku,
    category: data.category ?? null,
    manufacturer: data.manufacturer ?? null,
    partNumber: data.partNumber ?? null,
    unit: data.unit,
    wasteFactorPct: new Prisma.Decimal(data.wasteFactorPct),
    baseCost: data.isMarketRate ? null : toNullableDecimal(data.baseCost),
    isMarketRate: data.isMarketRate,
    markupPct: new Prisma.Decimal(data.markupPct),
    laborUnits: new Prisma.Decimal(data.laborUnits),
    supplier: data.supplier ?? null,
    notes: data.notes ?? null,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  };
}

export async function listConsumablesForDivision(divisionId: string) {
  await requireArea("materials");
  return prisma.consumableItem.findMany({
    where: { divisionId },
    orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
  });
}

/**
 * Blended INSTALL $/hr for the active scope (division + segment).
 * Consumables are division-shared; the rate follows the active segment.
 */
export async function getBlendedInstallRateForScope(
  divisionId: string,
  segment: "COMMERCIAL" | "RESIDENTIAL" | "STR",
) {
  await requireArea("materials");
  const positions = await prisma.laborPosition.findMany({
    where: { divisionId, segment, context: "INSTALL" },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  if (positions.length === 0) return null;
  try {
    return blendedInstallRate(positionsToQuotedInput(positions), "STANDARD");
  } catch {
    return null;
  }
}

export async function createConsumable(raw: unknown) {
  const user = await requireArea("materials");
  assertCatalogWrite(user);
  const data = createConsumableSchema.parse(raw);

  const division = await prisma.division.findUnique({
    where: { id: data.divisionId },
    select: { id: true },
  });
  if (!division) throw new Error("Division not found");

  try {
    await prisma.consumableItem.create({
      data: {
        divisionId: division.id,
        ...consumableWriteData(data),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(
        `SKU "${data.sku}" already exists in this division — pick a unique SKU`,
      );
    }
    throw err;
  }

  revalidateConsumables();
  return { ok: true as const };
}

export async function updateConsumable(raw: unknown) {
  const user = await requireArea("materials");
  assertCatalogWrite(user);
  const data = updateConsumableSchema.parse(raw);

  try {
    await prisma.consumableItem.update({
      where: { id: data.id },
      data: consumableWriteData(data),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(
        `SKU "${data.sku}" already exists in this division — pick a unique SKU`,
      );
    }
    throw err;
  }

  revalidateConsumables();
  return { ok: true as const };
}

export async function deleteConsumable(raw: unknown) {
  const user = await requireArea("materials");
  assertDelete(user);
  const data = deleteConsumableSchema.parse(raw);
  await prisma.consumableItem.delete({ where: { id: data.id } });
  revalidateConsumables();
  return { ok: true as const };
}
