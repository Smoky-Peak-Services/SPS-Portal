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

export function activityTypeForPhoneKind(kind: PhoneEventKind): ActivityType {
  return kind === "SMS" ? "SMS" : "CALL";
}

export function mergeBody(current: string | null, line: string): string {
  const lines = (current ?? "").split("\n").filter(Boolean);
  if (line && !lines.includes(line)) lines.push(line);
  return lines.join("\n");
}

/** Match Contact (preferred) then open Lead by last-10 digits. */
export async function matchPhoneTarget(
  national10: string | null | undefined,
): Promise<PhoneMatchTarget | null> {
  if (!national10 || !isValidUsNational10(national10)) return null;
  if (!isPiiConfigured()) return null;

  const contact = await prismaPii.contact.findFirst({
    where: { directPhone: { endsWith: national10 } },
    select: { id: true, customerId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (contact) {
    return {
      kind: "contact",
      contactId: contact.id,
      customerId: contact.customerId,
    };
  }

  const lead = await prismaPii.lead.findFirst({
    where: {
      phone: { endsWith: national10 },
      status: { notIn: CLOSED_LEAD },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (lead) return { kind: "lead", leadId: lead.id };
  return null;
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
}
