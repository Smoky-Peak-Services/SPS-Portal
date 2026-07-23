import { createHash } from "node:crypto";
import { z } from "zod";
import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { company } from "@/config/company";

const DEFAULT_COMPANY = "Residential";

const leadBodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  /** Submitter company. Blank/missing → "Residential" at write time. */
  company: z.string().max(200).optional(),
  /** Form Division / inquiry-type label (not org divisionSlug). */
  division: z.string().max(200).optional(),
  /** Optional; folded into message when present. */
  subject: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
  budget: z.string().max(100).optional(),
  timeline: z.string().max(100).optional(),
  /** Org routing only when auth is secret-only (no x-ingest-key). */
  divisionSlug: z.string().optional(),
});

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Normalize marketing payloads: alias form-division keys, and peel legacy
 * `Company:` / `Division:` / `Subject:` prefixes out of message when the
 * dedicated fields were not sent.
 */
export function normalizeLeadBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const raw = body as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };

  if (asTrimmedString(out.division) == null) {
    const alias =
      asTrimmedString(out.inquiryType) ??
      asTrimmedString(out.formDivision) ??
      asTrimmedString(out.divisionLabel) ??
      asTrimmedString(out.inquiry_type);
    if (alias) out.division = alias;
  }

  const peeled = peelLegacyMessage(asTrimmedString(out.message));
  if (asTrimmedString(out.company) == null && peeled.company) {
    out.company = peeled.company;
  }
  if (asTrimmedString(out.division) == null && peeled.division) {
    out.division = peeled.division;
  }
  if (asTrimmedString(out.subject) == null && peeled.subject) {
    out.subject = peeled.subject;
  }
  if (peeled.message !== undefined) {
    out.message = peeled.message;
  }

  return out;
}

export function peelLegacyMessage(message: string | undefined): {
  company?: string;
  division?: string;
  subject?: string;
  message?: string;
} {
  if (!message) return {};
  const lines = message.split(/\r?\n/);
  let companyValue: string | undefined;
  let divisionValue: string | undefined;
  let subjectValue: string | undefined;
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = /^(Company|Division|Subject):\s*(.*)$/i.exec(line);
    if (!match) break;
    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (!value) continue;
    if (key === "company") companyValue = value;
    else if (key === "division") divisionValue = value;
    else subjectValue = value;
  }
  while (i < lines.length && !(lines[i] ?? "").trim()) i += 1;
  const body = lines.slice(i).join("\n").trim();
  return {
    company: companyValue,
    division: divisionValue,
    subject: subjectValue,
    message: body || undefined,
  };
}

export function resolveCompany(raw: string | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : DEFAULT_COMPANY;
}

export function composeMessage(
  subject: string | undefined,
  message: string | undefined,
): string | null {
  const sub = subject?.trim();
  const body = message?.trim();
  if (sub && body) return `${sub}\n\n${body}`;
  if (sub) return sub;
  if (body) return body;
  return null;
}

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export type LeadIngestResult =
  | { ok: true; leadId: string }
  | { ok: false; status: number; error: string; reason?: "pii_unconfigured" };

/**
 * Public-site lead ingest. Auth via per-division IngestKey header `x-ingest-key`
 * and/or shared `x-ingest-secret` matching INGEST_SERVER_SECRET.
 *
 * Org Division: a valid `x-ingest-key` always wins (even when the shared secret
 * is also present). Secret-only requests use body `divisionSlug` or the CRM default.
 *
 * Form fields: `company` (default Residential), `division` (inquiry-type label),
 * `message` / optional `subject`.
 */
export async function handleLeadIngest(
  body: unknown,
  headers: { ingestKey?: string | null; ingestSecret?: string | null },
): Promise<LeadIngestResult> {
  if (!isPiiConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "Client (PII) database is not configured on this deployment yet.",
      reason: "pii_unconfigured",
    };
  }

  const parsed = leadBodySchema.safeParse(normalizeLeadBody(body));
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid payload" };
  }

  const data = parsed.data;
  let divisionSlug = data.divisionSlug ?? company.crm.defaultLeadDivisionSlug;

  const serverSecret = process.env.INGEST_SERVER_SECRET?.trim();
  const trusted = !!(serverSecret && headers.ingestSecret === serverSecret);
  const rawKey = headers.ingestKey?.trim() || null;

  if (!trusted && !rawKey) {
    return { ok: false, status: 401, error: "Missing ingest credentials" };
  }

  if (rawKey) {
    const key = await prismaPii.ingestKey.findFirst({
      where: { keyHash: hashKey(rawKey), revokedAt: null },
      include: { division: true },
    });
    if (!key) {
      return { ok: false, status: 401, error: "Invalid ingest key" };
    }
    divisionSlug = key.division.slug;
    await prismaPii.ingestKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
  }

  const orgDivision = await prismaPii.division.findUnique({
    where: { slug: divisionSlug },
  });
  if (!orgDivision) {
    return { ok: false, status: 400, error: "Unknown division" };
  }

  const disqualified =
    data.budget && company.crm.disqualifyBudgets.includes(data.budget);

  try {
    const lead = await prismaPii.lead.create({
      data: {
        divisionId: orgDivision.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        division: data.division?.trim() || null,
        company: resolveCompany(data.company),
        message: composeMessage(data.subject, data.message),
        budget: data.budget || null,
        timeline: data.timeline || null,
        source: "WEBSITE",
        status: disqualified ? "DISQUALIFIED" : "INQUIRY",
        closedAt: disqualified ? new Date() : null,
        activities: {
          create: {
            type: "STATUS_CHANGE",
            body: disqualified
              ? "Auto-disqualified by budget"
              : "Lead ingested from website",
          },
        },
      },
    });

    return { ok: true, leadId: lead.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] lead.create failed:", message);
    return { ok: false, status: 500, error: `Lead create failed: ${message}` };
  }
}
