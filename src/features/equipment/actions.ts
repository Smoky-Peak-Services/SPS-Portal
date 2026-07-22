"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireArea, assertCapability, type SessionUser } from "@/lib/session";
import {
  createEquipmentSchema,
  deleteEquipmentSchema,
  updateEquipmentSchema,
} from "./schemas";

function assertCatalogWrite(user: SessionUser) {
  assertCapability(user, "materials.catalog.write");
}

function assertDelete(user: SessionUser) {
  assertCapability(user, "materials.delete");
}

function revalidateEquipment() {
  revalidatePath("/materials/equipment");
}

function equipmentWriteData(data: {
  name: string;
  sku?: string | null;
  unit?: string | null;
  cost: number;
  supplier?: string | null;
  notes?: string | null;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    name: data.name,
    sku: data.sku ?? null,
    unit: data.unit ?? null,
    cost: new Prisma.Decimal(data.cost),
    supplier: data.supplier ?? null,
    notes: data.notes ?? null,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
  };
}

export async function listEquipmentForDivision(divisionId: string) {
  await requireArea("materials");
  return prisma.equipmentItem.findMany({
    where: { divisionId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createEquipment(raw: unknown) {
  const user = await requireArea("materials");
  assertCatalogWrite(user);
  const data = createEquipmentSchema.parse(raw);

  const division = await prisma.division.findUnique({
    where: { id: data.divisionId },
    select: { id: true },
  });
  if (!division) throw new Error("Division not found");

  try {
    await prisma.equipmentItem.create({
      data: {
        divisionId: division.id,
        ...equipmentWriteData(data),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(
        `Name "${data.name}" already exists in this division — pick a unique name`,
      );
    }
    throw err;
  }

  revalidateEquipment();
  return { ok: true as const };
}

export async function updateEquipment(raw: unknown) {
  const user = await requireArea("materials");
  assertCatalogWrite(user);
  const data = updateEquipmentSchema.parse(raw);

  try {
    await prisma.equipmentItem.update({
      where: { id: data.id },
      data: equipmentWriteData(data),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(
        `Name "${data.name}" already exists in this division — pick a unique name`,
      );
    }
    throw err;
  }

  revalidateEquipment();
  return { ok: true as const };
}

export async function deleteEquipment(raw: unknown) {
  const user = await requireArea("materials");
  assertDelete(user);
  const data = deleteEquipmentSchema.parse(raw);
  await prisma.equipmentItem.delete({ where: { id: data.id } });
  revalidateEquipment();
  return { ok: true as const };
}
