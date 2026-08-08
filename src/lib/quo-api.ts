/**
 * Quo (OpenPhone) REST helpers — server-only (uses API key).
 * Docs: https://www.quo.com/docs/mdx/api-reference/introduction
 */
import { parseUsPhone } from "@/lib/phone-parse";

const API_BASES = [
  "https://api.quo.com",
  "https://api.openphone.com",
] as const;

const QUO_API_VERSION = "2026-03-30";

export function quoApiKey(): string {
  return (
    process.env.OPENPHONE_API_KEY ??
    process.env.OP_API_KEY ??
    ""
  ).trim();
}

function workspacePhoneRaw(): string {
  return (
    process.env.SERVICE_PHONE ??
    process.env.OP_PHONE_NUMBER ??
    ""
  ).trim();
}

async function quoFetch(
  path: string,
  init?: RequestInit & { versioned?: boolean },
): Promise<Response | null> {
  const key = quoApiKey();
  if (!key) return null;

  const headers: Record<string, string> = {
    Authorization: key,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.versioned !== false) {
    headers["Quo-Api-Version"] = QUO_API_VERSION;
  }

  let last: Response | null = null;
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...init,
        headers,
        cache: "no-store",
      });
      last = res;
      // Fall through to alternate host only on clear "wrong API" 404s.
      if (res.status !== 404) return res;
    } catch {
      /* try next base */
    }
  }
  return last;
}

export type QuoPhoneNumber = {
  id: string;
  number?: string | null;
  formattedNumber?: string | null;
};

export async function listQuoPhoneNumbers(): Promise<QuoPhoneNumber[]> {
  const res = await quoFetch("/v1/phone-numbers", { versioned: false });
  if (!res?.ok) return [];
  const json = (await res.json()) as { data?: QuoPhoneNumber[] };
  return json.data ?? [];
}

/** Resolve PN… ids for the configured workspace phone (or all if unset). */
export async function resolveQuoResourceIds(): Promise<string[]> {
  const numbers = await listQuoPhoneNumbers();
  if (numbers.length === 0) return ["*"];

  const want = parseUsPhone(workspacePhoneRaw());
  if (!want) return ["*"];

  const matched = numbers.filter((n) => {
    const p = parseUsPhone(n.number ?? n.formattedNumber);
    return p?.national10 === want.national10;
  });
  if (matched.length === 0) return ["*"];
  return matched.map((n) => n.id);
}

export const DEFAULT_QUO_WEBHOOK_EVENTS = [
  "call.completed",
  "call.missed",
  "call.voicemail.completed",
  "call.recording.completed",
  "call.summary.completed",
  "call.transcript.completed",
  "message.received",
] as const;

export type CreateQuoWebhookResult =
  | {
      ok: true;
      id: string;
      key: string;
      url: string;
      events: string[];
    }
  | { ok: false; error: string; status?: number };

export async function createQuoWebhook(opts: {
  url: string;
  label?: string;
  events?: readonly string[];
  resourceIds?: string[];
}): Promise<CreateQuoWebhookResult> {
  if (!quoApiKey()) {
    return { ok: false, error: "OP_API_KEY / OPENPHONE_API_KEY not set" };
  }

  const resourceIds = opts.resourceIds ?? (await resolveQuoResourceIds());
  const body = {
    url: opts.url,
    label: opts.label ?? "SPS Portal Call Log",
    events: [...(opts.events ?? DEFAULT_QUO_WEBHOOK_EVENTS)],
    resourceIds,
    status: "enabled",
  };

  const res = await quoFetch("/webhooks", {
    method: "POST",
    body: JSON.stringify(body),
    versioned: true,
  });
  if (!res) return { ok: false, error: "Quo API unreachable" };
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: `Quo ${res.status}: ${text.slice(0, 300)}`,
      status: res.status,
    };
  }

  const json = (await res.json()) as {
    data?: { id?: string; key?: string; url?: string; events?: string[] };
  };
  const data = json.data;
  if (!data?.id || !data.key) {
    return { ok: false, error: "Quo webhook response missing id/key" };
  }
  return {
    ok: true,
    id: data.id,
    key: data.key,
    url: data.url ?? opts.url,
    events: data.events ?? body.events,
  };
}

export async function sendQuoWebhookTestEvent(
  webhookId: string,
  eventType: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await quoFetch(`/webhooks/${encodeURIComponent(webhookId)}/events/test`, {
    method: "POST",
    body: JSON.stringify({ eventType }),
    versioned: true,
  });
  if (!res) return { ok: false, error: "Quo API unreachable" };
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Quo ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

/** Fetch AI/Sona summary for a call when the webhook body is thin. */
export async function fetchCallSummaryFromApi(
  callId: string,
): Promise<{ summary: string[]; nextSteps: string[] } | null> {
  const res = await quoFetch(
    `/v1/call-summaries/${encodeURIComponent(callId)}`,
    { versioned: false },
  );
  if (!res?.ok) return null;
  const json = (await res.json()) as {
    data?: {
      summary?: string[] | null;
      nextSteps?: string[] | null;
      status?: string;
    };
  };
  const data = json.data;
  if (!data || data.status === "absent") return null;
  const summary = data.summary ?? [];
  const nextSteps = data.nextSteps ?? [];
  if (summary.length === 0 && nextSteps.length === 0) return null;
  return { summary, nextSteps };
}

export type ResolvedCallParties = {
  externalE164: string;
  workspaceE164: string | null;
  national10: string;
};

/** Fetch participant numbers for a call id and pick the external party. */
export async function resolveCallPartiesFromApi(
  callId: string,
): Promise<ResolvedCallParties | null> {
  const res = await quoFetch(`/v1/calls/${encodeURIComponent(callId)}`, {
    versioned: false,
  });
  if (!res?.ok) return null;

  const json = (await res.json()) as { data?: { participants?: string[] } };
  const participants = json.data?.participants ?? [];
  const workspace = parseUsPhone(workspacePhoneRaw());

  for (const raw of participants) {
    const parsed = parseUsPhone(raw);
    if (!parsed) continue;
    if (workspace && parsed.national10 === workspace.national10) continue;
    return {
      externalE164: parsed.e164,
      workspaceE164: workspace?.e164 ?? null,
      national10: parsed.national10,
    };
  }

  const first = parseUsPhone(participants[0]);
  if (!first) return null;
  if (workspace && first.national10 === workspace.national10) return null;

  return {
    externalE164: first.e164,
    workspaceE164: workspace?.e164 ?? null,
    national10: first.national10,
  };
}
