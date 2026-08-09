import { cache } from "react";
import type { Prisma } from "../../../prisma/generated/pii";
import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { requireCrmAccess } from "./authz";
import { billingMissing, isBillingComplete } from "./billing";

/** Page size for CRM list endpoints. */
const LIST_PAGE_SIZE = 50;

// TODO: add Postgres trigram (pg_trgm) indexes on Customer.displayName / Lead.name
// when CRM volume justifies it (e.g. >10k rows) — contains + insensitive scans are
// fine at current scale.

export type ListCustomersFilter = {
  q?: string;
  divisionId?: string;
  type?: "RESIDENTIAL" | "COMMERCIAL" | "STR";
  archived?: boolean;
  /** Opaque cursor = last row id from previous page. */
  cursor?: string;
};

const customerListInclude = {
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
} satisfies Prisma.CustomerInclude;

export type CustomerListRow = Prisma.CustomerGetPayload<{
  include: typeof customerListInclude;
}>;

const leadListInclude = {
  orgDivision: { select: { id: true, name: true, slug: true } },
  customer: { select: { id: true, displayName: true } },
} satisfies Prisma.LeadInclude;

export type LeadListRow = Prisma.LeadGetPayload<{
  include: typeof leadListInclude;
}>;

export async function listCrmDivisions() {
  await requireCrmAccess();
  if (!isPiiConfigured()) return [];
  return prismaPii.division.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listCustomers(filter: ListCustomersFilter = {}): Promise<{
  rows: CustomerListRow[];
  nextCursor: string | undefined;
}> {
  await requireCrmAccess();
  if (!isPiiConfigured()) return { rows: [], nextCursor: undefined };

  const q = filter.q?.trim();
  // TODO: trigram indexes when volume > ~10k (see file header).
  const rows = await prismaPii.customer.findMany({
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
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: LIST_PAGE_SIZE + 1,
    ...(filter.cursor
      ? { cursor: { id: filter.cursor }, skip: 1 }
      : {}),
    include: customerListInclude,
  });

  let nextCursor: string | undefined;
  if (rows.length > LIST_PAGE_SIZE) {
    const next = rows.pop()!;
    nextCursor = next.id;
  }
  return { rows, nextCursor };
}

export const getCustomerProfile = cache(async (id: string) => {
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
});

const ACTIVE_LEAD_STATUSES = [
  "INQUIRY",
  "SITE_VISIT",
  "ESTIMATE_SENT",
  "APPROVED",
] as const;

const ARCHIVED_LEAD_STATUSES = ["WON", "LOST", "DISQUALIFIED"] as const;

export type ListLeadsFilter = {
  q?: string;
  divisionId?: string;
  scope?: "active" | "archive";
  cursor?: string;
};

function leadSearchWhere(filter: ListLeadsFilter): Prisma.LeadWhereInput {
  const q = filter.q?.trim();
  const scope = filter.scope ?? "active";
  return {
    divisionId: filter.divisionId || undefined,
    status: {
      in: [
        ...(scope === "archive"
          ? ARCHIVED_LEAD_STATUSES
          : ACTIVE_LEAD_STATUSES),
      ],
    },
    OR: q
      ? [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };
}

export async function listLeads(filter: ListLeadsFilter = {}): Promise<{
  rows: LeadListRow[];
  nextCursor: string | undefined;
}> {
  await requireCrmAccess();
  if (!isPiiConfigured()) return { rows: [], nextCursor: undefined };

  // TODO: trigram indexes when volume > ~10k (see file header).
  const rows = await prismaPii.lead.findMany({
    where: leadSearchWhere(filter),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: LIST_PAGE_SIZE + 1,
    ...(filter.cursor
      ? { cursor: { id: filter.cursor }, skip: 1 }
      : {}),
    include: leadListInclude,
  });

  let nextCursor: string | undefined;
  if (rows.length > LIST_PAGE_SIZE) {
    const next = rows.pop()!;
    nextCursor = next.id;
  }
  return { rows, nextCursor };
}

/** Active pipeline board: counts per status + up to PAGE_SIZE cards per column. */
export async function listLeadBoard(filter: {
  q?: string;
  divisionId?: string;
}): Promise<{
  counts: Record<(typeof ACTIVE_LEAD_STATUSES)[number], number>;
  columns: Record<(typeof ACTIVE_LEAD_STATUSES)[number], LeadListRow[]>;
}> {
  await requireCrmAccess();
  const emptyCounts = Object.fromEntries(
    ACTIVE_LEAD_STATUSES.map((s) => [s, 0]),
  ) as Record<(typeof ACTIVE_LEAD_STATUSES)[number], number>;
  const emptyColumns = Object.fromEntries(
    ACTIVE_LEAD_STATUSES.map((s) => [s, [] as LeadListRow[]]),
  ) as Record<(typeof ACTIVE_LEAD_STATUSES)[number], LeadListRow[]>;

  if (!isPiiConfigured()) {
    return { counts: emptyCounts, columns: emptyColumns };
  }

  const q = filter.q?.trim();
  const baseWhere: Prisma.LeadWhereInput = {
    divisionId: filter.divisionId || undefined,
    OR: q
      ? [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const results = await Promise.all(
    ACTIVE_LEAD_STATUSES.map(async (status) => {
      const where: Prisma.LeadWhereInput = { ...baseWhere, status };
      const [count, rows] = await Promise.all([
        prismaPii.lead.count({ where }),
        prismaPii.lead.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: LIST_PAGE_SIZE,
          include: leadListInclude,
        }),
      ]);
      return { status, count, rows };
    }),
  );

  const counts = { ...emptyCounts };
  const columns = { ...emptyColumns };
  for (const r of results) {
    counts[r.status] = r.count;
    columns[r.status] = r.rows;
  }
  return { counts, columns };
}

export async function getLead(id: string) {
  await requireCrmAccess();
  if (!isPiiConfigured()) return null;
  return prismaPii.lead.findUnique({
    where: { id },
    include: {
      orgDivision: { select: { id: true, name: true, slug: true } },
      customer: { select: { id: true, displayName: true, type: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
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
