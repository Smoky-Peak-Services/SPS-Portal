/**
 * Shared lead write path for portal createLead and public ingest.
 */
import { company } from "@/config/company";
import { phoneForStorage, phoneNat10 } from "@/lib/phone-parse";

export type LeadSource =
  | "WEBSITE"
  | "PHONE"
  | "REFERRAL"
  | "WALK_IN"
  | "OTHER";

export type CreateLeadRecordInput = {
  divisionId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  /** Form inquiry-type label (not org division). */
  division?: string | null;
  message?: string | null;
  budget?: string | null;
  timeline?: string | null;
  source: LeadSource;
  /** Activity body when not auto-disqualified. */
  activityBody: string;
  /** Optional ingest idempotency key → Lead.externalId. */
  externalId?: string | null;
};

const DEFAULT_COMPANY = "Residential";

export function resolveLeadCompany(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : DEFAULT_COMPANY;
}

export function buildLeadCreateData(input: CreateLeadRecordInput) {
  const disqualified =
    !!input.budget && company.crm.disqualifyBudgets.includes(input.budget);
  const externalId = input.externalId?.trim() || null;

  return {
    divisionId: input.divisionId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: phoneForStorage(input.phone) ?? (input.phone?.trim() || null),
    phoneNat: phoneNat10(input.phone),
    company: resolveLeadCompany(input.company),
    division: input.division?.trim() || null,
    message: input.message?.trim() || null,
    budget: input.budget?.trim() || null,
    timeline: input.timeline?.trim() || null,
    source: input.source,
    status: (disqualified ? "DISQUALIFIED" : "INQUIRY") as
      | "DISQUALIFIED"
      | "INQUIRY",
    closedAt: disqualified ? new Date() : null,
    externalId,
    activities: {
      create: {
        type: "STATUS_CHANGE" as const,
        body: disqualified
          ? "Auto-disqualified by budget"
          : input.activityBody,
      },
    },
  };
}

/** Accepts PrismaClient, interactive tx, or the prismaPii proxy. */
type LeadWriter = {
  // Prisma's generic create/upsert signatures are not assignable to a narrow
  // structural type; callers pass prismaPii / tx as LeadWriter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lead: { create: (args: any) => Promise<{ id: string }> };
};

export async function createLeadRecord(
  tx: LeadWriter,
  input: CreateLeadRecordInput,
) {
  return tx.lead.create({ data: buildLeadCreateData(input) });
}
