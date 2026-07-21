"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCapability, type SessionUser } from "@/lib/session";
import { deleteByIdSchema, forceDeleteSchema } from "./schemas";
import { normalizeName } from "./normalize";
import {
  assertDelete,
  assertForceDelete,
  requireMaterialsAccess,
} from "./authz";

const MATERIALS_PATHS = [
  "/materials",
  "/materials/domains",
  "/materials/categories",
  "/materials/attributes",
  "/materials/items",
  "/materials/import-export",
] as const;

function revalidateMaterials() {
  for (const p of MATERIALS_PATHS) revalidatePath(p);
}

async function requireDeleteAccess(): Promise<SessionUser> {
  const user = await requireMaterialsAccess();
  assertDelete(user);
  return user;
}

async function requireForceDeleteAccess(): Promise<SessionUser> {
  const user = await requireMaterialsAccess();
  assertForceDelete(user);
  return user;
}

function namesMatch(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

export async function deleteMaterialItem(raw: unknown) {
  await requireDeleteAccess();
  const { id } = deleteByIdSchema.parse(raw);
  const item = await prisma.materialItem.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!item) throw new Error("Item not found");
  await prisma.materialItem.delete({ where: { id } });
  revalidateMaterials();
  return { id: item.id, name: item.name };
}

export async function deleteMaterialUnit(raw: unknown) {
  await requireForceDeleteAccess();
  const { id } = deleteByIdSchema.parse(raw);
  const unit = await prisma.materialUnit.findUnique({
    where: { id },
    select: { id: true, code: true, _count: { select: { items: true } } },
  });
  if (!unit) throw new Error("Unit not found");
  if (unit._count.items > 0) {
    throw new Error(
      `Unit ${unit.code} is still referenced by ${unit._count.items} item(s) — remove or reassign them first`,
    );
  }
  await prisma.materialUnit.delete({ where: { id } });
  revalidateMaterials();
  return { id: unit.id, code: unit.code };
}

export async function deleteMaterialDomain(raw: unknown) {
  await requireDeleteAccess();
  const { id } = deleteByIdSchema.parse(raw);
  const domain = await prisma.materialDomain.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { categories: true } },
    },
  });
  if (!domain) throw new Error("Domain not found");
  if (domain._count.categories > 0) {
    throw new Error(
      `Domain still has ${domain._count.categories} categories — use force delete or remove them first`,
    );
  }
  await prisma.materialDomain.delete({ where: { id } });
  revalidateMaterials();
  return { id: domain.id, name: domain.name };
}

export async function forceDeleteMaterialDomain(raw: unknown) {
  await requireForceDeleteAccess();
  const { id, confirmName } = forceDeleteSchema.parse(raw);
  const domain = await prisma.materialDomain.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      categories: { select: { id: true } },
    },
  });
  if (!domain) throw new Error("Domain not found");
  if (!namesMatch(domain.name, confirmName)) {
    throw new Error(`Confirmation name does not match domain "${domain.name}"`);
  }

  const categoryIds = domain.categories.map((c) => c.id);
  await prisma.$transaction(async (tx) => {
    if (categoryIds.length > 0) {
      await tx.materialItem.deleteMany({
        where: { categoryId: { in: categoryIds } },
      });
      await tx.materialCategory.deleteMany({
        where: { id: { in: categoryIds } },
      });
    }
    await tx.materialDomain.delete({ where: { id } });
  });

  revalidateMaterials();
  return { id: domain.id, name: domain.name };
}

export async function deleteMaterialCategory(raw: unknown) {
  await requireDeleteAccess();
  const { id } = deleteByIdSchema.parse(raw);
  const category = await prisma.materialCategory.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { items: true } },
    },
  });
  if (!category) throw new Error("Category not found");
  if (category._count.items > 0) {
    throw new Error(
      `Category still has ${category._count.items} items — use force delete or remove them first`,
    );
  }
  await prisma.materialCategory.delete({ where: { id } });
  revalidateMaterials();
  return { id: category.id, name: category.name };
}

export async function forceDeleteMaterialCategory(raw: unknown) {
  await requireForceDeleteAccess();
  const { id, confirmName } = forceDeleteSchema.parse(raw);
  const category = await prisma.materialCategory.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!category) throw new Error("Category not found");
  if (!namesMatch(category.name, confirmName)) {
    throw new Error(
      `Confirmation name does not match category "${category.name}"`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.materialItem.deleteMany({ where: { categoryId: id } });
    await tx.materialCategory.delete({ where: { id } });
  });

  revalidateMaterials();
  return { id: category.id, name: category.name };
}

export async function deleteMaterialAttribute(raw: unknown) {
  const user = await requireDeleteAccess();
  assertCapability(user, "materials.attributes.write");
  const { id } = deleteByIdSchema.parse(raw);
  const attr = await prisma.materialAttribute.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { assignments: true, values: true } },
    },
  });
  if (!attr) throw new Error("Attribute not found");
  if (attr._count.assignments > 0 || attr._count.values > 0) {
    throw new Error(
      `Attribute is still used by ${attr._count.assignments} assignment(s) and ${attr._count.values} item value(s) — use force delete or remove them first`,
    );
  }
  await prisma.materialAttribute.delete({ where: { id } });
  revalidateMaterials();
  return { id: attr.id, name: attr.name };
}

export async function forceDeleteMaterialAttribute(raw: unknown) {
  const user = await requireForceDeleteAccess();
  assertCapability(user, "materials.attributes.write");
  const { id, confirmName } = forceDeleteSchema.parse(raw);
  const attr = await prisma.materialAttribute.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      options: { select: { id: true } },
    },
  });
  if (!attr) throw new Error("Attribute not found");
  if (!namesMatch(attr.name, confirmName)) {
    throw new Error(
      `Confirmation name does not match attribute "${attr.name}"`,
    );
  }

  const optionIds = attr.options.map((o) => o.id);
  await prisma.$transaction(async (tx) => {
    if (optionIds.length > 0) {
      await tx.materialAttributeAssignment.updateMany({
        where: { defaultOptionId: { in: optionIds } },
        data: { defaultOptionId: null },
      });
      await tx.materialItemAttributeValue.deleteMany({
        where: { optionId: { in: optionIds } },
      });
    }
    await tx.materialItemAttributeValue.deleteMany({
      where: { attributeId: id },
    });
    await tx.materialAttributeAssignment.deleteMany({
      where: { attributeId: id },
    });
    await tx.materialAttribute.delete({ where: { id } });
  });

  revalidateMaterials();
  return { id: attr.id, name: attr.name };
}

export async function deleteMaterialAttributeOption(raw: unknown) {
  const user = await requireDeleteAccess();
  assertCapability(user, "materials.attributes.write");
  const { id } = deleteByIdSchema.parse(raw);
  const option = await prisma.materialAttributeOption.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      _count: {
        select: { itemValues: true, defaultFor: true },
      },
    },
  });
  if (!option) throw new Error("Option not found");
  if (option._count.itemValues > 0 || option._count.defaultFor > 0) {
    throw new Error(
      `Option is still used by ${option._count.itemValues} item value(s) and ${option._count.defaultFor} default assignment(s) — use force delete or clear them first`,
    );
  }
  await prisma.materialAttributeOption.delete({ where: { id } });
  revalidateMaterials();
  return { id: option.id, label: option.label };
}

export async function forceDeleteMaterialAttributeOption(raw: unknown) {
  const user = await requireForceDeleteAccess();
  assertCapability(user, "materials.attributes.write");
  const { id, confirmName } = forceDeleteSchema.parse(raw);
  const option = await prisma.materialAttributeOption.findUnique({
    where: { id },
    select: { id: true, label: true },
  });
  if (!option) throw new Error("Option not found");
  if (!namesMatch(option.label, confirmName)) {
    throw new Error(
      `Confirmation name does not match option "${option.label}"`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.materialAttributeAssignment.updateMany({
      where: { defaultOptionId: id },
      data: { defaultOptionId: null },
    });
    await tx.materialItemAttributeValue.deleteMany({
      where: { optionId: id },
    });
    await tx.materialAttributeOption.delete({ where: { id } });
  });

  revalidateMaterials();
  return { id: option.id, label: option.label };
}
