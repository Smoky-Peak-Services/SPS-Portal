"use server";

import { revalidatePath } from "next/cache";
import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { requireArea, requireUser } from "@/lib/session";
import { canAccess } from "@/config/permissions";
import { createCustomerSchema, createLocationSchema } from "./schemas";

const PII_UNCONFIGURED =
  "Client (PII) database is not configured on this deployment yet.";

export async function listCustomers(opts?: { q?: string }) {
  await requireArea("customers");
  if (!isPiiConfigured()) return [];

  const q = opts?.q?.trim();
  return prismaPii.customer.findMany({
    where: {
      archivedAt: null,
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { generalEmail: { contains: q, mode: "insensitive" } },
              { mainPhone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { displayName: "asc" },
    take: 100,
    include: {
      division: { select: { slug: true, name: true } },
      _count: { select: { serviceLocations: true } },
    },
  });
}

export async function listCustomerOptions() {
  const user = await requireUser();
  if (
    !canAccess(user.role, "customers") &&
    !canAccess(user.role, "jobs") &&
    !canAccess(user.role, "tickets")
  ) {
    return [];
  }
  if (!isPiiConfigured()) return [];

  return prismaPii.customer.findMany({
    where: { archivedAt: null },
    orderBy: { displayName: "asc" },
    take: 200,
    select: { id: true, displayName: true, divisionId: true },
  });
}

export async function listLocationsForCustomer(customerId: string) {
  await requireArea("customers");
  if (!isPiiConfigured()) return [];

  return prismaPii.serviceLocation.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCustomer(raw: unknown) {
  const user = await requireArea("customers");
  if (!isPiiConfigured()) {
    throw new Error(PII_UNCONFIGURED);
  }

  const data = createCustomerSchema.parse(raw);
  const customer = await prismaPii.customer.create({
    data: {
      displayName: data.displayName,
      type: data.type,
      divisionId: data.divisionId,
      generalEmail: data.generalEmail || null,
      mainPhone: data.mainPhone || null,
      hqLine1: data.hqLine1 || null,
      hqCity: data.hqCity || null,
      hqRegion: data.hqRegion || null,
      hqPostal: data.hqPostal || null,
      notes: data.notes || null,
      createdById: user.id,
    },
  });
  revalidatePath("/clients");
  return customer;
}

export async function createLocation(raw: unknown) {
  await requireArea("customers");
  if (!isPiiConfigured()) {
    throw new Error(PII_UNCONFIGURED);
  }

  const data = createLocationSchema.parse(raw);
  const location = await prismaPii.serviceLocation.create({
    data: {
      customerId: data.customerId,
      siteName: data.siteName || null,
      line1: data.line1,
      line2: data.line2 || null,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      classification: data.classification,
      notes: data.notes || null,
    },
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${data.customerId}`);
  return location;
}

export async function getCustomer(id: string) {
  await requireArea("customers");
  if (!isPiiConfigured()) return null;

  return prismaPii.customer.findUnique({
    where: { id },
    include: {
      division: true,
      serviceLocations: { orderBy: { createdAt: "desc" } },
      contacts: true,
    },
  });
}
