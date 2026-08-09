import {
  isPiiConfigured,
  prismaPii,
  type ActivityType,
  type PhoneEventKind,
} from "@/lib/prisma-pii";
import { isValidUsNational10 } from "@/lib/phone-parse";

const CLOSED_LEAD: Array<"WON" | "LOST" | "DISQUALIFIED"> = [
  "WON",
  "LOST",
  "DISQUALIFIED",
];

export type PhoneMatchTarget =
  | { kind: "contact"; contactId: string; customerId: string }
  | { kind: "lead"; leadId: string };

/** Call Log / UI-facing match (customer or lead display). */
export type PhoneMatchDisplay =
  | { kind: "customer"; id: string; name: string; divisionSlug: string }
  | { kind: "lead"; id: string; name: string; divisionSlug: string };

export function activityTypeForPhoneKind(kind: PhoneEventKind): ActivityType {
  return kind === "SMS" ? "SMS" : "CALL";
}

export function mergeBody(current: string | null, line: string): string {
  const lines = (current ?? "").split("\n").filter(Boolean);
  if (line && !lines.includes(line)) lines.push(line);
  return lines.join("\n");
}

export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

/**
 * Refuse to guess when more than one row shares a national-10.
 * Shared by matchPhoneTarget and Call Log so UI and write path never disagree.
 */
export function pickUniqueByNat<T>(
  national10: string,
  rows: T[],
  label: string,
  idOf: (row: T) => string,
): T | null {
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    console.warn(
      `[phone-match] ambiguous ${label} for nat=${national10} ids=${rows.map(idOf).join(",")}`,
    );
    return null;
  }
  return rows[0] ?? null;
}

/** Match Contact (preferred) then open Lead by indexed last-10 digits. */
export async function matchPhoneTarget(
  national10: string | null | undefined,
): Promise<PhoneMatchTarget | null> {
  if (!national10 || !isValidUsNational10(national10)) return null;
  if (!isPiiConfigured()) return null;

  const contacts = await prismaPii.contact.findMany({
    where: { directPhoneNat: national10 },
    select: { id: true, customerId: true },
    take: 2,
  });
  const contact = pickUniqueByNat(
    national10,
    contacts,
    "contact",
    (c) => c.id,
  );
  if (contact) {
    return {
      kind: "contact",
      contactId: contact.id,
      customerId: contact.customerId,
    };
  }

  const leads = await prismaPii.lead.findMany({
    where: {
      phoneNat: national10,
      status: { notIn: CLOSED_LEAD },
    },
    select: { id: true },
    take: 2,
  });
  const lead = pickUniqueByNat(national10, leads, "lead", (l) => l.id);
  if (lead) return { kind: "lead", leadId: lead.id };
  return null;
}

/**
 * Build nat10 → display match from Contact/Lead rows loaded for Call Log.
 * Same ambiguity rule as matchPhoneTarget (contact preferred over lead).
 */
export function buildPhoneMatchDisplayMap(opts: {
  contacts: Array<{
    directPhoneNat: string | null;
    customer: {
      id: string;
      displayName: string;
      division: { slug: string };
    };
  }>;
  leads: Array<{
    id: string;
    name: string;
    phoneNat: string | null;
    orgDivision: { slug: string };
  }>;
}): Map<string, PhoneMatchDisplay> {
  const contactBuckets = new Map<
    string,
    Array<{
      directPhoneNat: string | null;
      customer: {
        id: string;
        displayName: string;
        division: { slug: string };
      };
    }>
  >();
  for (const c of opts.contacts) {
    const nat = c.directPhoneNat;
    if (!nat || !isValidUsNational10(nat)) continue;
    const list = contactBuckets.get(nat) ?? [];
    list.push(c);
    contactBuckets.set(nat, list);
  }

  const leadBuckets = new Map<
    string,
    Array<{
      id: string;
      name: string;
      phoneNat: string | null;
      orgDivision: { slug: string };
    }>
  >();
  for (const l of opts.leads) {
    const nat = l.phoneNat;
    if (!nat || !isValidUsNational10(nat)) continue;
    const list = leadBuckets.get(nat) ?? [];
    list.push(l);
    leadBuckets.set(nat, list);
  }

  const out = new Map<string, PhoneMatchDisplay>();
  const nats = new Set([...contactBuckets.keys(), ...leadBuckets.keys()]);
  for (const nat of nats) {
    const contacts = contactBuckets.get(nat) ?? [];
    const uniqueContact = pickUniqueByNat(nat, contacts, "contact", (c) =>
      c.customer.id,
    );
    if (uniqueContact) {
      out.set(nat, {
        kind: "customer",
        id: uniqueContact.customer.id,
        name: uniqueContact.customer.displayName,
        divisionSlug: uniqueContact.customer.division.slug,
      });
      continue;
    }
    const leads = leadBuckets.get(nat) ?? [];
    const uniqueLead = pickUniqueByNat(nat, leads, "lead", (l) => l.id);
    if (uniqueLead) {
      out.set(nat, {
        kind: "lead",
        id: uniqueLead.id,
        name: uniqueLead.name,
        divisionSlug: uniqueLead.orgDivision.slug,
      });
    }
  }
  return out;
}

/** Upsert Activity by externalId when a Contact or open Lead matches. */
export async function upsertMatchedActivity(opts: {
  externalId: string;
  kind: PhoneEventKind;
  partyNat: string | null;
  line: string;
}): Promise<"attached" | "merged" | "skipped"> {
  if (!opts.line || !isPiiConfigured()) return "skipped";

  const existing = await prismaPii.activity.findUnique({
    where: { externalId: opts.externalId },
    select: { id: true, body: true },
  });

  if (existing) {
    await prismaPii.activity.update({
      where: { id: existing.id },
      data: { body: mergeBody(existing.body, opts.line) },
    });
    return "merged";
  }

  const target = await matchPhoneTarget(opts.partyNat);
  if (!target) return "skipped";

  try {
    await prismaPii.activity.create({
      data: {
        type: activityTypeForPhoneKind(opts.kind),
        body: opts.line,
        externalId: opts.externalId,
        ...(target.kind === "contact"
          ? { customerId: target.customerId, contactId: target.contactId }
          : { leadId: target.leadId }),
      },
    });
    return "attached";
  } catch (err) {
    if (!isPrismaUniqueViolation(err)) throw err;
    const again = await prismaPii.activity.findUnique({
      where: { externalId: opts.externalId },
      select: { id: true, body: true },
    });
    if (!again) throw err;
    await prismaPii.activity.update({
      where: { id: again.id },
      data: { body: mergeBody(again.body, opts.line) },
    });
    return "merged";
  }
}
