import { isPrismaUniqueViolation } from "@/features/phone/match-target";

export type OpenPhoneWebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

export function parseOccurredAt(s?: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function resultFromWebhookError(err: unknown): OpenPhoneWebhookResult {
  if (isPrismaUniqueViolation(err)) {
    return { status: 200, body: { ok: true } };
  }
  return { status: 500, body: { error: "processing failed" } };
}
