import { isPiiConfigured, prismaPii } from "@/lib/prisma-pii";
import { requireCrmAccess } from "@/features/crm/authz";
import { formatPhoneDisplay } from "@/lib/phone-format";
import {
  externalPartyE164,
  phoneEventGroupKey,
} from "@/features/phone/group-key";
import { parseCallBody } from "@/features/phone/parse-call-body";
import { buildPhoneMatchDisplayMap } from "@/features/phone/match-target";
import { isValidUsNational10 } from "@/lib/phone-parse";

export type CallLogMatch =
  | { kind: "customer"; id: string; name: string; divisionSlug: string }
  | { kind: "lead"; id: string; name: string; divisionSlug: string }
  | null;

export interface CallLogGroup {
  key: string;
  display: string;
  partyE164: string | null;
  leadMessage: string | null;
  lastAt: Date;
  total: number;
  counts: { calls: number; missed: number; voicemails: number; sms: number };
  statusLine: string | null;
  summary: string | null;
  transcript: string | null;
  smsPreview: string | null;
  latestRecordingUrl: string | null;
  match: CallLogMatch;
}

function buildLeadMessage(
  summary: string | null,
  transcript: string | null,
  smsPreview: string | null,
): string | null {
  const parts: string[] = [];
  if (summary) parts.push(summary);
  if (smsPreview) parts.push(`SMS: ${smsPreview}`);
  if (transcript) parts.push(`Transcript: ${transcript}`);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

/**
 * Last 14 days of phone activity, grouped by external number, tagged with a
 * Contact/Lead match when present.
 */
export async function recentCallLog(): Promise<CallLogGroup[]> {
  await requireCrmAccess();
  if (!isPiiConfigured()) return [];

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const events = await prismaPii.phoneEvent.findMany({
    where: { occurredAt: { gte: since }, dismissed: false },
    orderBy: { occurredAt: "desc" },
    take: 2000,
  });
  if (events.length === 0) return [];

  const groups = new Map<string, CallLogGroup>();
  for (const e of events) {
    const key = phoneEventGroupKey(e);
    let g = groups.get(key);
    if (!g) {
      const partyE164 = externalPartyE164(e);
      const displayRaw =
        e.partyNat && isValidUsNational10(e.partyNat)
          ? e.partyNat
          : (partyE164 ?? null);
      const parsed = parseCallBody(e.body);
      g = {
        key,
        display: displayRaw
          ? formatPhoneDisplay(displayRaw)
          : "Unknown caller",
        partyE164,
        leadMessage: null,
        lastAt: e.occurredAt,
        total: 0,
        counts: { calls: 0, missed: 0, voicemails: 0, sms: 0 },
        statusLine: parsed.statusLine,
        summary: parsed.summary,
        transcript: parsed.transcript,
        smsPreview: parsed.smsPreview,
        latestRecordingUrl: e.recordingUrl,
        match: null,
      };
      groups.set(key, g);
    } else {
      const parsed = parseCallBody(e.body);
      // Events are newest-first; only fill fields still empty from older rows.
      if (!g.statusLine && parsed.statusLine) g.statusLine = parsed.statusLine;
      if (!g.summary && parsed.summary) g.summary = parsed.summary;
      if (!g.transcript && parsed.transcript) g.transcript = parsed.transcript;
      if (!g.smsPreview && parsed.smsPreview) g.smsPreview = parsed.smsPreview;
      if (!g.latestRecordingUrl && e.recordingUrl)
        g.latestRecordingUrl = e.recordingUrl;
    }
    g.leadMessage = buildLeadMessage(
      g.summary,
      g.transcript,
      g.smsPreview,
    );
    g.total += 1;
    if (e.kind === "CALL") g.counts.calls += 1;
    else if (e.kind === "MISSED_CALL") g.counts.missed += 1;
    else if (e.kind === "VOICEMAIL") g.counts.voicemails += 1;
    else if (e.kind === "SMS") g.counts.sms += 1;
  }

  const keys = [...groups.keys()].filter((k) => isValidUsNational10(k));
  if (keys.length === 0) {
    return [...groups.values()].sort(
      (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
    );
  }

  const [contacts, leads] = await Promise.all([
    prismaPii.contact.findMany({
      where: { directPhoneNat: { in: keys } },
      select: {
        directPhoneNat: true,
        customer: {
          select: {
            id: true,
            displayName: true,
            division: { select: { slug: true } },
          },
        },
      },
    }),
    prismaPii.lead.findMany({
      where: {
        phoneNat: { in: keys },
        status: { notIn: ["WON", "LOST", "DISQUALIFIED"] },
      },
      select: {
        id: true,
        name: true,
        phoneNat: true,
        orgDivision: { select: { slug: true } },
      },
    }),
  ]);

  const matchByNat = buildPhoneMatchDisplayMap({ contacts, leads });
  for (const g of groups.values()) {
    g.match = matchByNat.get(g.key) ?? null;
  }

  return [...groups.values()].sort(
    (a, b) => b.lastAt.getTime() - a.lastAt.getTime(),
  );
}
