/**
 * OpenPhone / Quo webhook processor.
 * Always upserts PhoneEvent; attaches Activity when Contact or open Lead matches.
 */
import { isPiiConfigured, prismaPii, type PhoneEventKind } from "@/lib/prisma-pii";
import {
  parseUsPhone,
  verifyOpenPhoneSignature,
  openPhoneWebhookSecret,
  type QuoWebhookHeaders,
} from "@/lib/openphone";
import { fetchCallSummaryFromApi } from "@/lib/quo-api";
import {
  buildSummaryLine,
  buildTranscriptLine,
  callKindAndLineBeta,
  callKindAndLineLegacy,
  resolveBetaParties,
  resolveLegacyParties,
} from "@/features/phone/openphone-payload";
import {
  mergeBody,
  upsertMatchedActivity,
} from "@/features/phone/match-target";

type Media = { url?: string | null; type?: string; duration?: number };
type PhoneObject = {
  id?: string;
  from?: string;
  to?: string;
  direction?: "incoming" | "outgoing" | string;
  body?: string;
  text?: string;
  media?: Media[];
  voicemail?: Media | null;
  answeredAt?: string | null;
  createdAt?: string;
  aiHandled?: string | boolean;
  answeredBy?: string;
  callId?: string;
  summary?: string[];
  nextSteps?: string[];
  dialogue?: { content?: string }[];
  participants?: string[];
};
type BetaResource = {
  id?: string;
  direction?: "incoming" | "outgoing" | string;
  status?: string;
  createdAt?: string;
  answeredAt?: string | null;
  completedAt?: string | null;
  hasVoicemail?: boolean;
  callId?: string;
  summary?: string[] | null;
  nextSteps?: string[] | null;
  dialogue?: { content?: string }[] | null;
  text?: string;
  body?: string;
  media?: Media[];
  recordings?: Media[];
};
type BetaContext = {
  participants?: { external?: string[]; workspace?: string[] };
  senderIdentifier?: string;
  recipientIdentifiers?: string[];
};
type OpenPhoneEvent = {
  id?: string;
  type?: string;
  createdAt?: string;
  data?: {
    object?: PhoneObject;
    resource?: BetaResource;
    context?: BetaContext;
  };
};

async function upsertEvent(opts: {
  externalId: string;
  kind: PhoneEventKind;
  direction: string;
  externalRaw: string | null;
  workspaceRaw: string | null;
  line: string;
  recordingUrl?: string | null;
  occurredAt: Date;
}) {
  const existing = await prismaPii.phoneEvent.findUnique({
    where: { externalId: opts.externalId },
    select: { id: true, body: true, partyNat: true },
  });

  if (existing) {
    await prismaPii.phoneEvent.update({
      where: { id: existing.id },
      data: {
        body: mergeBody(existing.body, opts.line),
        ...(opts.recordingUrl ? { recordingUrl: opts.recordingUrl } : {}),
      },
    });
    await upsertMatchedActivity({
      externalId: opts.externalId,
      kind: opts.kind,
      partyNat: existing.partyNat,
      line: opts.line,
    });
    return;
  }

  const incoming = opts.direction === "incoming";
  const ext = parseUsPhone(opts.externalRaw);
  const ws = parseUsPhone(opts.workspaceRaw);
  const partyNat = ext?.national10 ?? null;
  await prismaPii.phoneEvent.create({
    data: {
      externalId: opts.externalId,
      kind: opts.kind,
      direction: opts.direction,
      fromE164: incoming ? (ext?.e164 ?? null) : (ws?.e164 ?? null),
      toE164: incoming ? (ws?.e164 ?? null) : (ext?.e164 ?? null),
      partyNat,
      body: opts.line || null,
      recordingUrl: opts.recordingUrl ?? null,
      occurredAt: opts.occurredAt,
    },
  });
  await upsertMatchedActivity({
    externalId: opts.externalId,
    kind: opts.kind,
    partyNat,
    line: opts.line,
  });
}

function isBeta(evt: OpenPhoneEvent): boolean {
  return !!evt.data?.resource;
}

async function handleEvent(evt: OpenPhoneEvent): Promise<string> {
  const type = evt.type ?? "";
  const when = (s?: string) => (s ? new Date(s) : new Date());

  if (isBeta(evt)) {
    return handleBetaEvent(evt, type, when);
  }
  return handleLegacyEvent(evt, type, when);
}

async function handleLegacyEvent(
  evt: OpenPhoneEvent,
  type: string,
  when: (s?: string) => Date,
): Promise<string> {
  const o = evt.data?.object ?? {};

  if (type === "message.received") {
    if (o.direction && o.direction !== "incoming")
      return "ignored:outbound_message";
    if (!o.id) return "ignored:message_missing_id";
    const parties = resolveLegacyParties("incoming", o);
    const text = o.body ?? o.text ?? "";
    const mediaNote = o.media?.length
      ? ` [${o.media.length} attachment(s)]`
      : "";
    await upsertEvent({
      externalId: o.id,
      kind: "SMS",
      direction: "incoming",
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line: `SMS: ${text}${mediaNote}`,
      occurredAt: when(o.createdAt ?? evt.createdAt),
    });
    return "stored:message_received";
  }

  if (type === "call.completed") {
    if (!o.id) return "ignored:call_missing_id";
    const direction = o.direction === "outgoing" ? "outgoing" : "incoming";
    const parties = resolveLegacyParties(direction, o);
    const { kind, line, recording } = callKindAndLineLegacy(o);
    await upsertEvent({
      externalId: o.id,
      kind,
      direction,
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line,
      recordingUrl: recording ?? null,
      occurredAt: when(o.createdAt ?? evt.createdAt),
    });
    return `stored:call_completed:${kind}`;
  }

  if (type === "call.recording.completed") {
    const url = o.media?.[0]?.url;
    if (!o.id || !url) return "ignored:recording_missing_id_or_url";
    const direction = o.direction === "outgoing" ? "outgoing" : "incoming";
    const parties = resolveLegacyParties(direction, o);
    await upsertEvent({
      externalId: o.id,
      kind: "CALL",
      direction,
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line: "Recording available",
      recordingUrl: url,
      occurredAt: when(o.createdAt ?? evt.createdAt),
    });
    return "stored:call_recording";
  }

  if (type === "call.summary.completed" || type === "call.transcript.completed") {
    const callId = o.callId;
    if (!callId) return "ignored:summary_missing_call_id";
    return mergeSummaryOrTranscript(
      type,
      callId,
      o.summary,
      o.nextSteps,
      o.dialogue,
    );
  }

  return `ignored:unhandled_type:${type || "unknown"}`;
}

async function handleBetaEvent(
  evt: OpenPhoneEvent,
  type: string,
  when: (s?: string) => Date,
): Promise<string> {
  const resource = evt.data?.resource ?? {};
  const context = evt.data?.context;
  const parties = resolveBetaParties(context);

  if (type === "message.received") {
    if (resource.direction && resource.direction !== "incoming")
      return "ignored:outbound_message";
    if (!resource.id) return "ignored:message_missing_id";
    const text = resource.text ?? resource.body ?? "";
    const mediaNote = resource.media?.length
      ? ` [${resource.media.length} attachment(s)]`
      : "";
    await upsertEvent({
      externalId: resource.id,
      kind: "SMS",
      direction: "incoming",
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line: `SMS: ${text}${mediaNote}`,
      occurredAt: when(resource.createdAt ?? evt.createdAt),
    });
    return "stored:message_received";
  }

  if (type === "call.missed") {
    if (!resource.id) return "ignored:call_missing_id";
    const direction =
      resource.direction === "outgoing" ? "outgoing" : "incoming";
    await upsertEvent({
      externalId: resource.id,
      kind: "MISSED_CALL",
      direction,
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line: "Missed call",
      occurredAt: when(
        resource.createdAt ?? resource.completedAt ?? evt.createdAt,
      ),
    });
    return "stored:call_missed";
  }

  if (type === "call.voicemail.completed") {
    if (!resource.id) return "ignored:call_missing_id";
    const direction =
      resource.direction === "outgoing" ? "outgoing" : "incoming";
    const url = resource.recordings?.[0]?.url ?? resource.media?.[0]?.url;
    await upsertEvent({
      externalId: resource.id,
      kind: "VOICEMAIL",
      direction,
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line: "Voicemail",
      recordingUrl: url ?? null,
      occurredAt: when(
        resource.createdAt ?? resource.completedAt ?? evt.createdAt,
      ),
    });
    return "stored:call_voicemail";
  }

  if (type === "call.completed") {
    if (!resource.id) return "ignored:call_missing_id";
    const direction =
      resource.direction === "outgoing" ? "outgoing" : "incoming";
    const incoming = direction === "incoming";
    const { kind, line } = incoming
      ? callKindAndLineBeta(resource)
      : {
          kind: "CALL" as PhoneEventKind,
          line:
            resource.status === "answered" || resource.answeredAt
              ? "Outbound call — answered"
              : "Outbound call — no answer",
        };
    await upsertEvent({
      externalId: resource.id,
      kind,
      direction,
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line,
      recordingUrl: null,
      occurredAt: when(
        resource.createdAt ?? resource.completedAt ?? evt.createdAt,
      ),
    });
    return `stored:call_completed:${kind}`;
  }

  if (type === "call.recording.completed") {
    const url = resource.recordings?.[0]?.url ?? resource.media?.[0]?.url;
    if (!resource.id || !url) return "ignored:recording_missing_id_or_url";
    const direction =
      resource.direction === "outgoing" ? "outgoing" : "incoming";
    await upsertEvent({
      externalId: resource.id,
      kind: "CALL",
      direction,
      externalRaw: parties.externalRaw,
      workspaceRaw: parties.workspaceRaw,
      line: "Recording available",
      recordingUrl: url,
      occurredAt: when(
        resource.createdAt ?? resource.completedAt ?? evt.createdAt,
      ),
    });
    return "stored:call_recording";
  }

  if (type === "call.summary.completed" || type === "call.transcript.completed") {
    const callId = resource.callId ?? resource.id;
    if (!callId) return "ignored:summary_missing_call_id";
    return mergeSummaryOrTranscript(
      type,
      callId,
      resource.summary,
      resource.nextSteps,
      resource.dialogue,
    );
  }

  return `ignored:unhandled_type:${type || "unknown"}`;
}

async function mergeSummaryOrTranscript(
  type: string,
  callId: string,
  summary: string[] | null | undefined,
  nextSteps: string[] | null | undefined,
  dialogue: { content?: string }[] | null | undefined,
): Promise<string> {
  const existing = await prismaPii.phoneEvent.findUnique({
    where: { externalId: callId },
    select: { id: true, body: true, partyNat: true, kind: true },
  });
  if (!existing) return "ignored:no_existing_call";

  let line: string | null = null;
  if (type === "call.summary.completed") {
    line = buildSummaryLine(summary, nextSteps);
    if (!line) {
      const enriched = await fetchCallSummaryFromApi(callId);
      if (enriched) {
        line = buildSummaryLine(enriched.summary, enriched.nextSteps);
      }
    }
    if (!line) return "ignored:empty_summary";
  } else {
    line = buildTranscriptLine(dialogue);
    if (!line) return "ignored:empty_transcript";
  }

  await prismaPii.phoneEvent.update({
    where: { id: existing.id },
    data: { body: mergeBody(existing.body, line) },
  });
  await upsertMatchedActivity({
    externalId: callId,
    kind: existing.kind,
    partyNat: existing.partyNat,
    line,
  });
  return type === "call.summary.completed"
    ? "stored:call_summary"
    : "stored:call_transcript";
}

export type OpenPhoneWebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function processOpenPhoneWebhook(
  rawBody: string,
  headers: QuoWebhookHeaders | string | null,
): Promise<OpenPhoneWebhookResult> {
  if (process.env.NODE_ENV === "production" && !openPhoneWebhookSecret()) {
    console.error("[openphone] rejected: webhook secret missing in production");
    return { status: 503, body: { error: "Webhook not configured" } };
  }
  if (!verifyOpenPhoneSignature(rawBody, headers)) {
    const h =
      typeof headers === "string" || headers === null
        ? { openphoneSignature: headers }
        : headers;
    console.warn(
      `[openphone] rejected: bad signature legacy=${!!h.openphoneSignature} whsecHeaders=${!!(h.webhookId && h.webhookSignature)}`,
    );
    return { status: 401, body: { error: "bad signature" } };
  }
  if (!isPiiConfigured()) {
    return { status: 503, body: { error: "pii_unconfigured" } };
  }

  let evt: OpenPhoneEvent;
  try {
    evt = JSON.parse(rawBody) as OpenPhoneEvent;
  } catch {
    return { status: 200, body: { ok: true } };
  }

  try {
    const action = await handleEvent(evt);
    const id =
      evt.data?.resource?.id ?? evt.data?.object?.id ?? evt.id ?? "none";
    console.log(
      `[openphone] processed type=${evt.type ?? "unknown"} id=${id} action=${action}`,
    );
  } catch (e) {
    console.error("[openphone] handler error", e);
    return { status: 500, body: { error: "processing failed" } };
  }

  return { status: 200, body: { ok: true } };
}

function headersFromRequest(req: {
  headers: { get(name: string): string | null };
}): QuoWebhookHeaders {
  return {
    openphoneSignature:
      req.headers.get("openphone-signature") ??
      req.headers.get("x-openphone-signature"),
    webhookId: req.headers.get("webhook-id"),
    webhookTimestamp: req.headers.get("webhook-timestamp"),
    webhookSignature: req.headers.get("webhook-signature"),
  };
}

export { headersFromRequest };
