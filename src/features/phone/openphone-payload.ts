import { parseUsPhone } from "@/lib/phone-parse";
import type { PhoneEventKind } from "@/lib/prisma-pii";

export type CallParties = {
  externalRaw: string | null;
  workspaceRaw: string | null;
};

export function pickFirstValidPhone(
  candidates: (string | null | undefined)[],
): string | null {
  for (const c of candidates) {
    if (c && parseUsPhone(c)) return c.trim();
  }
  return null;
}

function validatedEndpoint(raw: string | null | undefined): string | null {
  if (!raw || !parseUsPhone(raw)) return null;
  return raw.trim();
}

/** Legacy `data.object` call/message parties — prefer participants over from/to. */
export function resolveLegacyParties(
  direction: string,
  o: { from?: string; to?: string; participants?: string[] },
): CallParties {
  const incoming = direction === "incoming";
  const participant = pickFirstValidPhone(o.participants ?? []);
  const fromValid = validatedEndpoint(o.from);
  const toValid = validatedEndpoint(o.to);

  const externalRaw = participant ?? (incoming ? fromValid : toValid);
  const workspaceRaw = incoming ? toValid : fromValid;
  return { externalRaw, workspaceRaw };
}

/** Beta `data.context` parties for calls and messages. */
export function resolveBetaParties(context?: {
  participants?: { external?: string[]; workspace?: string[] };
  senderIdentifier?: string;
  recipientIdentifiers?: string[];
}): CallParties {
  const externalRaw = pickFirstValidPhone(context?.participants?.external ?? []);
  const workspaceRaw = pickFirstValidPhone(
    context?.participants?.workspace ?? [],
  );
  if (externalRaw) return { externalRaw, workspaceRaw };

  const sender = validatedEndpoint(context?.senderIdentifier);
  if (sender) {
    return {
      externalRaw: sender,
      workspaceRaw: pickFirstValidPhone(context?.recipientIdentifiers ?? []),
    };
  }
  return { externalRaw: null, workspaceRaw };
}

export const AI_ANSWERED_LINE = "AI answered (Sona) — call back";
export const HUMAN_ANSWERED_LINE = "Inbound call — answered";

export function callKindAndLineLegacy(o: {
  direction?: string;
  answeredAt?: string | null;
  voicemail?: { url?: string | null; duration?: number } | null;
  aiHandled?: string | boolean;
}): { kind: PhoneEventKind; line: string; recording?: string } {
  const incoming = o.direction === "incoming";
  const answered = !!o.answeredAt;
  const vm = o.voicemail;
  const ai =
    typeof o.aiHandled === "boolean"
      ? o.aiHandled
      : typeof o.aiHandled === "string" &&
        o.aiHandled.toLowerCase().includes("ai");

  if (incoming && !answered && vm?.url) {
    return {
      kind: "VOICEMAIL",
      line: `Voicemail (${vm.duration ?? "?"}s)`,
      recording: vm.url,
    };
  }
  if (incoming && !answered) return { kind: "MISSED_CALL", line: "Missed call" };
  if (incoming) {
    return ai
      ? { kind: "MISSED_CALL", line: AI_ANSWERED_LINE }
      : { kind: "CALL", line: HUMAN_ANSWERED_LINE };
  }
  return {
    kind: "CALL",
    line: answered ? "Outbound call — answered" : "Outbound call — no answer",
  };
}

export function callKindAndLineBeta(resource: {
  status?: string;
  answeredAt?: string | null;
  hasVoicemail?: boolean;
}): { kind: PhoneEventKind; line: string } {
  const status = (resource.status ?? "").toLowerCase();
  const answered = status === "answered" || !!resource.answeredAt;
  const aiHandled = status === "ai-handled";
  const hasVm = resource.hasVoicemail === true;

  if (aiHandled) {
    return { kind: "MISSED_CALL", line: AI_ANSWERED_LINE };
  }
  if (!answered && hasVm) {
    return { kind: "VOICEMAIL", line: "Voicemail" };
  }
  if (!answered || status === "unanswered" || status === "abandoned") {
    return { kind: "MISSED_CALL", line: "Missed call" };
  }
  return { kind: "CALL", line: HUMAN_ANSWERED_LINE };
}

export function buildSummaryLine(
  summary: string[] | null | undefined,
  nextSteps: string[] | null | undefined,
): string | null {
  const s = (summary ?? []).join(" ").trim();
  const next = (nextSteps ?? []).join("; ").trim();
  if (!s && !next) return null;
  return `Summary: ${s}${next ? ` | Next: ${next}` : ""}`;
}

export function buildTranscriptLine(
  dialogue: { content?: string }[] | null | undefined,
): string | null {
  const t = (dialogue ?? [])
    .map((d) => d.content ?? "")
    .join(" ")
    .trim();
  if (!t) return null;
  return `Transcript: ${t.length > 1500 ? `${t.slice(0, 1500)}…` : t}`;
}
