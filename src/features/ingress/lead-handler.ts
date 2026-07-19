import { createHash } from "node:crypto";
import { z } from "zod";
import { prismaPii } from "@/lib/prisma-pii";
import { company } from "@/config/company";

const leadBodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
  budget: z.string().max(100).optional(),
  timeline: z.string().max(100).optional(),
  divisionSlug: z.string().optional(),
});

function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export type LeadIngestResult =
  | { ok: true; leadId: string }
  | { ok: false; status: number; error: string };

/**
 * Public-site lead ingest. Auth via per-division IngestKey header `x-ingest-key`
 * or shared `x-ingest-secret` matching INGEST_SERVER_SECRET.
 */
export async function handleLeadIngest(
  body: unknown,
  headers: { ingestKey?: string | null; ingestSecret?: string | null },
): Promise<LeadIngestResult> {
  const parsed = leadBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid payload" };
  }

  const data = parsed.data;
  let divisionSlug = data.divisionSlug ?? company.crm.defaultLeadDivisionSlug;

  const serverSecret = process.env.INGEST_SERVER_SECRET?.trim();
  const trusted = !!(serverSecret && headers.ingestSecret === serverSecret);

  if (!trusted) {
    const rawKey = headers.ingestKey?.trim();
    if (!rawKey) {
      return { ok: false, status: 401, error: "Missing ingest credentials" };
    }
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

  const division = await prismaPii.division.findUnique({
    where: { slug: divisionSlug },
  });
  if (!division) {
    return { ok: false, status: 400, error: "Unknown division" };
  }

  const disqualified =
    data.budget && company.crm.disqualifyBudgets.includes(data.budget);

  const lead = await prismaPii.lead.create({
    data: {
      divisionId: division.id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      message: data.message || null,
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
}
