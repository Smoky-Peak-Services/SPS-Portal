"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CapabilityEffect, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/session";
import { ALL_ROLES } from "@/config/permissions";
import { CAPABILITIES, resetRoleCapabilitiesToDefaults } from "@/config/capabilities";

const roleSchema = z.enum([
  "admin",
  "power_user",
  "sales",
  "accounting",
  "field_supervisor",
  "field_tech",
]);

export async function listRoleCapabilityMatrix() {
  await requireCapability("settings.permissions.manage");
  const rows = await prisma.roleCapability.findMany({
    select: { role: true, capabilityId: true, allowed: true },
  });
  return { capabilities: CAPABILITIES, roles: ALL_ROLES, rows };
}

export async function saveRoleCapabilityMatrix(raw: unknown) {
  await requireCapability("settings.permissions.manage");
  const schema = z.object({
    entries: z.array(
      z.object({
        role: roleSchema,
        capabilityId: z.string().min(1),
        allowed: z.boolean(),
      }),
    ),
  });
  const { entries } = schema.parse(raw);

  await prisma.$transaction(
    entries.map((e) =>
      prisma.roleCapability.upsert({
        where: {
          role_capabilityId: {
            role: e.role as Role,
            capabilityId: e.capabilityId,
          },
        },
        create: {
          role: e.role as Role,
          capabilityId: e.capabilityId,
          allowed: e.allowed,
        },
        update: { allowed: e.allowed },
      }),
    ),
  );

  revalidatePath("/settings/permissions");
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function resetRoleCapabilityDefaults() {
  await requireCapability("settings.permissions.manage");
  await resetRoleCapabilitiesToDefaults(prisma);
  revalidatePath("/settings/permissions");
  return { ok: true };
}

export async function listUsersForSettings() {
  await requireCapability("settings.users.manage");
  return prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      capabilityOverrides: {
        select: { capabilityId: true, effect: true },
      },
    },
  });
}

export async function updateUserRole(raw: unknown) {
  await requireCapability("settings.users.manage");
  const data = z
    .object({ userId: z.string().min(1), role: roleSchema })
    .parse(raw);
  await prisma.user.update({
    where: { id: data.userId },
    data: { role: data.role as Role },
  });
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function setUserCapabilityOverride(raw: unknown) {
  await requireCapability("settings.users.manage");
  const data = z
    .object({
      userId: z.string().min(1),
      capabilityId: z.string().min(1),
      effect: z.enum(["ALLOW", "DENY", "INHERIT"]),
    })
    .parse(raw);

  if (data.effect === "INHERIT") {
    await prisma.userCapabilityOverride.deleteMany({
      where: {
        userId: data.userId,
        capabilityId: data.capabilityId,
      },
    });
  } else {
    await prisma.userCapabilityOverride.upsert({
      where: {
        userId_capabilityId: {
          userId: data.userId,
          capabilityId: data.capabilityId,
        },
      },
      create: {
        userId: data.userId,
        capabilityId: data.capabilityId,
        effect: data.effect as CapabilityEffect,
      },
      update: { effect: data.effect as CapabilityEffect },
    });
  }

  revalidatePath("/settings/users");
  return { ok: true };
}
