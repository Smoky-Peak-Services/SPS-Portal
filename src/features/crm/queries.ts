import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { requireCrmAccess } from "./authz";
import { billingMissing, isBillingComplete } from "./billing";

export type ListCustomersFilter = {
  q?: string;
  divisionId?: string;
  type?: "RESIDENTIAL" | "COMMERCIAL" | "STR";
  archived?: boolean;
};

export async function listCrmDivisions() {
  await requireCrmAccess();
  if (!isPiiConfigured()) return [];
  return prismaPii.division.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listCustomers(filter: ListCustomersFilter = {}) {
  await requireCrmAccess();
  if (!isPiiConfigured()) return [];

  const q = filter.q?.trim();
  return prismaPii.customer.findMany({
    where: {
      archivedAt: filter.archived ? { not: null } : null,
      divisionId: filter.divisionId || undefined,
      type: filter.type || undefined,
      OR: q
        ? [
            { displayName: { contains: q, mode: "insensitive" } },
            { generalEmail: { contains: q, mode: "insensitive" } },
            { mainPhone: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: [{ displayName: "asc" }],
    include: {
      division: { select: { id: true, name: true, slug: true } },
      billingProfile: {
        select: {
          billingName: true,
          billingEmail: true,
          billingLine1: true,
          billingCity: true,
          billingRegion: true,
          billingPostal: true,
          profileType: true,
        },
      },
      _count: {
        select: { contacts: true, serviceLocations: true },
      },
    },
  });
}

export async function getCustomerProfile(id: string) {
  await requireCrmAccess();
  if (!isPiiConfigured()) return null;

  const customer = await prismaPii.customer.findUnique({
    where: { id },
    include: {
      division: { select: { id: true, name: true, slug: true } },
      billingProfile: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
      serviceLocations: { orderBy: [{ siteName: "asc" }, { line1: "asc" }] },
      activities: {
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          serviceLocation: { select: { id: true, siteName: true, line1: true } },
        },
      },
    },
  });
  if (!customer) return null;

  const billing = customer.billingProfile;
  const billingStatus = billing
    ? {
        complete: isBillingComplete(billing),
        missing: billingMissing(billing),
      }
    : { complete: false, missing: ["billing profile"] };

  return { ...customer, billingStatus };
}

export async function getCustomerForEdit(id: string) {
  await requireCrmAccess();
  if (!isPiiConfigured()) return null;
  return prismaPii.customer.findUnique({
    where: { id },
    include: {
      division: { select: { id: true, name: true, slug: true } },
      billingProfile: true,
      contacts: true,
    },
  });
}
