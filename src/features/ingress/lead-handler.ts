import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { safeEq } from "@/lib/openphone-signature";
import { company } from "@/config/company";
import {
  createLeadRecord,
  resolveLeadCompany,
} from "@/features/crm/create-lead-record";

const SOFT_DEDUPE_MS = 5 * 60 * 1000;

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
  divisionSlug: z.string().trim().optional(),
  /** Optional idempotency key → Lead.externalId (CDN / double-submit). */
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

/** Empty / whitespace divisionSlug falls back to CRM default. */
export function resolveIngestDivisionSlug(
  raw: string | undefined | null,
): string {
  return raw?.trim() || company.crm.defaultLeadDivisionSlug;
}

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
  return resolveLeadCompany(raw);
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
  | { ok: true; leadId: string; duplicate?: boolean }
  | { ok: false; status: number; error: string; reason?: "pii_unconfigured" };

/**
 * Public-site lead ingest. Auth via per-division IngestKey header `x-ingest-key`
 * and/or shared `x-ingest-secret` matching INGEST_SERVER_SECRET.
 *
 * Org Division: a valid `x-ingest-key` always wins (even when the shared secret
 * is also present). Secret-only requests use body `divisionSlug` or the CRM default.
 *
 * Form fields: `company` (default Residential), `division` (inquiry-type label),
 * `message` / optional `subject`, optional `idempotencyKey`.
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
  let divisionSlug = resolveIngestDivisionSlug(data.divisionSlug);

  const serverSecret = process.env.INGEST_SERVER_SECRET?.trim();
  const providedSecret = headers.ingestSecret?.trim() ?? "";
  const trusted = !!(
    serverSecret &&
    providedSecret &&
    safeEq(providedSecret, serverSecret)
  );
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

  const name = data.name.trim();
  const email = data.email?.trim() || null;
  const externalId = data.idempotencyKey?.trim() || null;

  try {
    if (externalId) {
      const existingByKey = await prismaPii.lead.findUnique({
        where: { externalId },
        select: { id: true },
      });
      if (existingByKey) {
        return { ok: true, leadId: existingByKey.id, duplicate: true };
      }
    } else if (email) {
      const since = new Date(Date.now() - SOFT_DEDUPE_MS);
      const softDup = await prismaPii.lead.findFirst({
        where: {
          divisionId: orgDivision.id,
          email,
          name,
          createdAt: { gte: since },
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      if (softDup) {
        return { ok: true, leadId: softDup.id, duplicate: true };
      }
    }

    const lead = await createLeadRecord(prismaPii, {
      divisionId: orgDivision.id,
      name,
      email,
      phone: data.phone || null,
      division: data.division?.trim() || null,
      company: data.company,
      message: composeMessage(data.subject, data.message),
      budget: data.budget || null,
      timeline: data.timeline || null,
      source: "WEBSITE",
      activityBody: "Lead ingested from website",
      externalId,
    });

    revalidatePath("/leads");
    if (data.phone) revalidatePath("/call-log");

    return { ok: true, leadId: lead.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Race on unique externalId: treat as successful duplicate.
    if (
      externalId &&
      typeof err === "object" &&
      err &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const again = await prismaPii.lead.findUnique({
        where: { externalId },
        select: { id: true },
      });
      if (again) return { ok: true, leadId: again.id, duplicate: true };
    }
    console.error("[ingest] lead.create failed:", message);
    return { ok: false, status: 500, error: "Ingest failed" };
  }
}
