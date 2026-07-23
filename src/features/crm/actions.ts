"use server";

import { revalidatePath } from "next/cache";
import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { requireCrmArchive, requireCrmWrite } from "./authz";
import {
  archiveCustomerSchema,
  createContactSchema,
  createCustomerActivitySchema,
  createCustomerSchema,
  createServiceLocationSchema,
  deleteContactSchema,
  deleteServiceLocationSchema,
  updateBillingProfileSchema,
  updateContactSchema,
  updateCustomerSchema,
  updateServiceLocationSchema,
} from "./schemas";
import {
  normalizeServiceLines,
  validateServiceLines,
  type ServiceLine,
} from "./service-location";

const CLIENTS_PATHS = ["/clients", "/clients/archive"] as const;

function revalidateClients(id?: string) {
  for (const p of CLIENTS_PATHS) revalidatePath(p);
  if (id) {
    revalidatePath(`/clients/${id}`);
    revalidatePath(`/clients/${id}/billing`);
    revalidatePath(`/clients/${id}/contacts`);
    revalidatePath(`/clients/${id}/locations`);
    revalidatePath(`/clients/${id}/activity`);
  }
}

function emptyToNull(v: string | null | undefined) {
  const t = v?.trim();
  return t ? t : null;
}

function defaultBillingType(type: "RESIDENTIAL" | "COMMERCIAL" | "STR") {
  return type === "COMMERCIAL" ? "ENTITY" : "INDIVIDUAL";
}

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function createCustomer(
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = createCustomerSchema.parse(raw);

  const division = await prismaPii.division.findUnique({
    where: { id: data.divisionId },
  });
  if (!division) return { ok: false, error: "Unknown division." };

  const customer = await prismaPii.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        type: data.type,
        displayName: data.displayName.trim(),
        divisionId: data.divisionId,
        generalEmail: emptyToNull(data.generalEmail),
        mainPhone: emptyToNull(data.mainPhone),
        website: emptyToNull(data.website),
        summary: emptyToNull(data.summary),
        source: emptyToNull(data.source),
        notes: emptyToNull(data.notes),
        hqLine1: emptyToNull(data.hqLine1),
        hqLine2: emptyToNull(data.hqLine2),
        hqCity: emptyToNull(data.hqCity),
        hqRegion: emptyToNull(data.hqRegion),
        hqPostal: emptyToNull(data.hqPostal),
        hqLat: data.hqLat ?? null,
        hqLng: data.hqLng ?? null,
        createdById: user.id,
        billingProfile: {
          create: {
            profileType: defaultBillingType(data.type),
            billingName:
              data.type === "COMMERCIAL" ? data.displayName.trim() : null,
          },
        },
      },
    });

    const first = data.contactFirstName?.trim();
    if (first) {
      await tx.contact.create({
        data: {
          customerId: created.id,
          firstName: first,
          lastName: emptyToNull(data.contactLastName),
          directEmail: emptyToNull(data.contactEmail),
          directPhone: emptyToNull(data.contactPhone),
          roleTag: data.contactRoleTag ?? "CLIENT",
          isPrimary: true,
          isBilling: true,
        },
      });
    }

    await tx.activity.create({
      data: {
        type: "STATUS_CHANGE",
        body: "Customer account created",
        customerId: created.id,
        createdById: user.id,
      },
    });

    return created;
  });

  revalidateClients(customer.id);
  return { ok: true, id: customer.id };
}

export async function updateCustomer(raw: unknown): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = updateCustomerSchema.parse(raw);

  if (data.divisionId) {
    const division = await prismaPii.division.findUnique({
      where: { id: data.divisionId },
    });
    if (!division) return { ok: false, error: "Unknown division." };
  }

  await prismaPii.customer.update({
    where: { id: data.id },
    data: {
      type: data.type,
      displayName: data.displayName?.trim(),
      divisionId: data.divisionId,
      generalEmail:
        data.generalEmail !== undefined
          ? emptyToNull(data.generalEmail)
          : undefined,
      mainPhone:
        data.mainPhone !== undefined ? emptyToNull(data.mainPhone) : undefined,
      website: data.website !== undefined ? emptyToNull(data.website) : undefined,
      source: data.source !== undefined ? emptyToNull(data.source) : undefined,
      notes: data.notes !== undefined ? emptyToNull(data.notes) : undefined,
      summary:
        data.summary !== undefined ? emptyToNull(data.summary) : undefined,
      hqLine1:
        data.hqLine1 !== undefined ? emptyToNull(data.hqLine1) : undefined,
      hqLine2:
        data.hqLine2 !== undefined ? emptyToNull(data.hqLine2) : undefined,
      hqCity: data.hqCity !== undefined ? emptyToNull(data.hqCity) : undefined,
      hqRegion:
        data.hqRegion !== undefined ? emptyToNull(data.hqRegion) : undefined,
      hqPostal:
        data.hqPostal !== undefined ? emptyToNull(data.hqPostal) : undefined,
      hqLat: data.hqLat === undefined ? undefined : data.hqLat,
      hqLng: data.hqLng === undefined ? undefined : data.hqLng,
    },
  });

  revalidateClients(data.id);
  return { ok: true, id: data.id };
}

export async function archiveCustomer(raw: unknown): Promise<ActionResult> {
  await requireCrmArchive();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = archiveCustomerSchema.parse(raw);
  await prismaPii.customer.update({
    where: { id: data.id },
    data: { archivedAt: new Date() },
  });
  revalidateClients(data.id);
  return { ok: true, id: data.id };
}

export async function restoreCustomer(raw: unknown): Promise<ActionResult> {
  await requireCrmArchive();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = archiveCustomerSchema.parse(raw);
  await prismaPii.customer.update({
    where: { id: data.id },
    data: { archivedAt: null },
  });
  revalidateClients(data.id);
  return { ok: true, id: data.id };
}

export async function updateBillingProfile(
  raw: unknown,
): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = updateBillingProfileSchema.parse(raw);

  await prismaPii.billingProfile.upsert({
    where: { rootOrgId: data.rootOrgId },
    create: {
      rootOrgId: data.rootOrgId,
      profileType: data.profileType,
      billingName: emptyToNull(data.billingName),
      billingEmail: emptyToNull(data.billingEmail),
      billingPhone: emptyToNull(data.billingPhone),
      billingLine1: emptyToNull(data.billingLine1),
      billingLine2: emptyToNull(data.billingLine2),
      billingCity: emptyToNull(data.billingCity),
      billingRegion: emptyToNull(data.billingRegion),
      billingPostal: emptyToNull(data.billingPostal),
      billingLat: data.billingLat ?? null,
      billingLng: data.billingLng ?? null,
      pointOfContactId: emptyToNull(data.pointOfContactId),
      taxExemptionNumber: emptyToNull(data.taxExemptionNumber),
      taxExemptEntityType: data.taxExemptEntityType ?? null,
      taxExemptCertOnFile: data.taxExemptCertOnFile ?? false,
      smaStatus: data.smaStatus ?? null,
    },
    update: {
      profileType: data.profileType,
      billingName: emptyToNull(data.billingName),
      billingEmail: emptyToNull(data.billingEmail),
      billingPhone: emptyToNull(data.billingPhone),
      billingLine1: emptyToNull(data.billingLine1),
      billingLine2: emptyToNull(data.billingLine2),
      billingCity: emptyToNull(data.billingCity),
      billingRegion: emptyToNull(data.billingRegion),
      billingPostal: emptyToNull(data.billingPostal),
      billingLat: data.billingLat ?? null,
      billingLng: data.billingLng ?? null,
      pointOfContactId: emptyToNull(data.pointOfContactId),
      taxExemptionNumber: emptyToNull(data.taxExemptionNumber),
      taxExemptEntityType: data.taxExemptEntityType ?? null,
      taxExemptCertOnFile: data.taxExemptCertOnFile ?? false,
      smaStatus: data.smaStatus ?? null,
    },
  });

  revalidateClients(data.rootOrgId);
  return { ok: true, id: data.rootOrgId };
}

export async function createContact(raw: unknown): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = createContactSchema.parse(raw);

  const contact = await prismaPii.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.contact.updateMany({
        where: { customerId: data.customerId },
        data: { isPrimary: false },
      });
    }
    if (data.isBilling) {
      await tx.contact.updateMany({
        where: { customerId: data.customerId },
        data: { isBilling: false },
      });
    }
    return tx.contact.create({
      data: {
        customerId: data.customerId,
        firstName: data.firstName.trim(),
        lastName: emptyToNull(data.lastName),
        directEmail: emptyToNull(data.directEmail),
        directPhone: emptyToNull(data.directPhone),
        roleTag: data.roleTag ?? null,
        isPrimary: data.isPrimary ?? false,
        isBilling: data.isBilling ?? false,
      },
    });
  });

  revalidateClients(data.customerId);
  return { ok: true, id: contact.id };
}

export async function updateContact(raw: unknown): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = updateContactSchema.parse(raw);
  const existing = await prismaPii.contact.findUnique({
    where: { id: data.id },
  });
  if (!existing) return { ok: false, error: "Contact not found." };

  await prismaPii.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.contact.updateMany({
        where: { customerId: existing.customerId, NOT: { id: data.id } },
        data: { isPrimary: false },
      });
    }
    if (data.isBilling) {
      await tx.contact.updateMany({
        where: { customerId: existing.customerId, NOT: { id: data.id } },
        data: { isBilling: false },
      });
    }
    await tx.contact.update({
      where: { id: data.id },
      data: {
        firstName: data.firstName?.trim(),
        lastName:
          data.lastName !== undefined ? emptyToNull(data.lastName) : undefined,
        directEmail:
          data.directEmail !== undefined
            ? emptyToNull(data.directEmail)
            : undefined,
        directPhone:
          data.directPhone !== undefined
            ? emptyToNull(data.directPhone)
            : undefined,
        roleTag: data.roleTag === undefined ? undefined : data.roleTag,
        isPrimary: data.isPrimary,
        isBilling: data.isBilling,
      },
    });
  });

  revalidateClients(existing.customerId);
  return { ok: true, id: data.id };
}

export async function deleteContact(raw: unknown): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = deleteContactSchema.parse(raw);
  const existing = await prismaPii.contact.findUnique({
    where: { id: data.id },
  });
  if (!existing) return { ok: false, error: "Contact not found." };
  await prismaPii.contact.delete({ where: { id: data.id } });
  revalidateClients(existing.customerId);
  return { ok: true };
}

export async function createServiceLocation(
  raw: unknown,
): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = createServiceLocationSchema.parse(raw);
  const lines = normalizeServiceLines(
    data.classification,
    data.serviceLines as ServiceLine[],
  );
  const err = validateServiceLines(data.classification, lines);
  if (err) return { ok: false, error: err };

  const loc = await prismaPii.serviceLocation.create({
    data: {
      customerId: data.customerId,
      siteName: emptyToNull(data.siteName),
      classification: data.classification,
      serviceLines: lines,
      line1: data.line1.trim(),
      line2: emptyToNull(data.line2),
      city: data.city.trim(),
      region: data.region.trim(),
      postalCode: data.postalCode.trim(),
      country: data.country?.trim() || "US",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: emptyToNull(data.notes),
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      complexitySelections: data.complexitySelections ?? [],
    },
  });

  revalidateClients(data.customerId);
  return { ok: true, id: loc.id };
}

export async function updateServiceLocation(
  raw: unknown,
): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = updateServiceLocationSchema.parse(raw);
  const existing = await prismaPii.serviceLocation.findUnique({
    where: { id: data.id },
  });
  if (!existing) return { ok: false, error: "Service location not found." };

  const classification = data.classification ?? existing.classification;
  const lines = normalizeServiceLines(
    classification,
    (data.serviceLines as ServiceLine[] | undefined) ??
      (existing.serviceLines as ServiceLine[]),
  );
  const err = validateServiceLines(classification, lines);
  if (err) return { ok: false, error: err };

  await prismaPii.serviceLocation.update({
    where: { id: data.id },
    data: {
      siteName:
        data.siteName !== undefined ? emptyToNull(data.siteName) : undefined,
      classification: data.classification,
      serviceLines: lines,
      line1: data.line1?.trim(),
      line2: data.line2 !== undefined ? emptyToNull(data.line2) : undefined,
      city: data.city?.trim(),
      region: data.region?.trim(),
      postalCode: data.postalCode?.trim(),
      country: data.country?.trim(),
      latitude: data.latitude === undefined ? undefined : data.latitude,
      longitude: data.longitude === undefined ? undefined : data.longitude,
      notes: data.notes !== undefined ? emptyToNull(data.notes) : undefined,
      bedrooms: data.bedrooms === undefined ? undefined : data.bedrooms,
      bathrooms: data.bathrooms === undefined ? undefined : data.bathrooms,
      complexitySelections: data.complexitySelections,
    },
  });

  revalidateClients(existing.customerId);
  return { ok: true, id: data.id };
}

export async function deleteServiceLocation(
  raw: unknown,
): Promise<ActionResult> {
  await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = deleteServiceLocationSchema.parse(raw);
  const existing = await prismaPii.serviceLocation.findUnique({
    where: { id: data.id },
  });
  if (!existing) return { ok: false, error: "Service location not found." };
  await prismaPii.serviceLocation.delete({ where: { id: data.id } });
  revalidateClients(existing.customerId);
  return { ok: true };
}

export async function createCustomerActivity(
  raw: unknown,
): Promise<ActionResult> {
  const user = await requireCrmWrite();
  if (!isPiiConfigured()) {
    return { ok: false, error: "PII database is not configured." };
  }
  const data = createCustomerActivitySchema.parse(raw);

  const activity = await prismaPii.activity.create({
    data: {
      type: "NOTE",
      body: data.body.trim(),
      customerId: data.customerId,
      serviceLocationId: emptyToNull(data.serviceLocationId),
      createdById: user.id,
    },
  });

  revalidateClients(data.customerId);
  return { ok: true, id: activity.id };
}
