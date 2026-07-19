import { prismaPii } from "@/lib/prisma-pii";

export type CustomerSummary = {
  id: string;
  displayName: string;
  type: string;
  mainPhone: string | null;
  generalEmail: string | null;
};

export type LocationSummary = {
  id: string;
  siteName: string | null;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  customerId: string | null;
};

/** Attach customer display names onto ops rows that only store customerId. */
export async function attachCustomers<T extends { customerId?: string | null }>(
  rows: T[],
): Promise<(T & { customer: CustomerSummary | null })[]> {
  const ids = [
    ...new Set(rows.map((r) => r.customerId).filter(Boolean)),
  ] as string[];
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, customer: null }));
  }

  const customers = await prismaPii.customer.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      displayName: true,
      type: true,
      mainPhone: true,
      generalEmail: true,
    },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));

  return rows.map((r) => ({
    ...r,
    customer: r.customerId ? (byId.get(r.customerId) ?? null) : null,
  }));
}

/** Attach service-location summaries onto ops rows that store propertyId. */
export async function attachLocations<T extends { propertyId?: string | null }>(
  rows: T[],
): Promise<(T & { property: LocationSummary | null })[]> {
  const ids = [
    ...new Set(rows.map((r) => r.propertyId).filter(Boolean)),
  ] as string[];
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, property: null }));
  }

  const locations = await prismaPii.serviceLocation.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      siteName: true,
      line1: true,
      city: true,
      region: true,
      postalCode: true,
      customerId: true,
    },
  });
  const byId = new Map(locations.map((l) => [l.id, l]));

  return rows.map((r) => ({
    ...r,
    property: r.propertyId ? (byId.get(r.propertyId) ?? null) : null,
  }));
}

export function formatLocation(
  loc: LocationSummary | null | undefined,
): string {
  if (!loc) return "—";
  const name = loc.siteName ? `${loc.siteName} · ` : "";
  return `${name}${loc.line1}, ${loc.city}, ${loc.region} ${loc.postalCode}`;
}
