"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireArea } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { deleteByIdSchema, forceDeleteSchema } from "./schemas";
import { normalizeName } from "./normalize";

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

async function requireAdmin(): Promise<SessionUser> {
  const user = await requireArea("materials");
  if (user.role !== "admin") {
    throw new Error("Only admins can delete materials catalog structure");
  }
  return user;
}

function namesMatch(a: string, b: string): boolean {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

export async function deleteMaterialItem(raw: unknown) {
  await requireArea("materials");
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
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
    throw new Error(
      `Confirmation name does not match domain "${domain.name}"`,
    );
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
  await requireAdmin();
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
  // Assignments cascade via onDelete
  await prisma.materialCategory.delete({ where: { id } });
  revalidateMaterials();
  return { id: category.id, name: category.name };
}

export async function forceDeleteMaterialCategory(raw: unknown) {
  await requireAdmin();
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
