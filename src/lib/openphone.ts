import { createHmac, timingSafeEqual } from "node:crypto";
import { toE164 } from "@/lib/phone-parse";

export {
  isQuoResourceId,
  isValidUsNational10,
  parseUsPhone,
  toE164,
  phoneNational,
  type ParsedUsPhone,
} from "@/lib/phone-parse";

/**
 * What we persist. Prefer E.164 so the OpenPhone match key is consistent, but
 * never drop a number we can't parse — keep the trimmed input.
 */
export function phoneForStorage(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  return toE164(t) ?? t;
}

/**
 * Combined signing secrets. Both env names are accepted and merged (comma lists
 * on either). Prefer not to let OPENPHONE_* shadow a newer OP_WEBHOOK_SECRET
 * whsec_ key — Quo recreates keys when webhooks are re-registered.
 */
export function openPhoneWebhookSecret(): string {
  const parts = [
    process.env.OP_WEBHOOK_SECRET,
    process.env.OPENPHONE_WEBHOOK_SECRET,
  ]
    .flatMap((v) => (v ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].join(",");
}

export type QuoWebhookHeaders = {
  /** Legacy OpenPhone: hmac;1;<ts>;<sig> */
  openphoneSignature?: string | null;
  /** Quo 2026 Svix-style */
  webhookId?: string | null;
  webhookTimestamp?: string | null;
  webhookSignature?: string | null;
};

function safeEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function secretList(): string[] {
  return openPhoneWebhookSecret()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Decode a Quo whsec_… signing key to raw HMAC key bytes. */
export function decodeWhsecKey(secret: string): Buffer | null {
  const t = secret.trim();
  if (!t.startsWith("whsec_")) return null;
  try {
    return Buffer.from(t.slice("whsec_".length), "base64");
  } catch {
    return null;
  }
}

/**
 * Quo 2026 signature: HMAC-SHA256 over `{id}.{timestamp}.{rawBody}`,
 * key = base64-decode(whsec_… remainder). Header: `v1,<base64>` entries.
 */
export function verifyQuoWhsecSignature(
  rawBody: string,
  webhookId: string | null | undefined,
  webhookTimestamp: string | null | undefined,
  webhookSignature: string | null | undefined,
  secrets: string[] = secretList(),
): boolean {
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return false;
  // Reject stale deliveries (replay protection); allow 5 minutes skew.
  const skewSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skewSec > 5 * 60) return false;

  const signed = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const provided = webhookSignature
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [ver, sig] = p.split(",", 2);
      return ver === "v1" && sig ? sig : null;
    })
    .filter((s): s is string => !!s);

  if (provided.length === 0) return false;

  for (const secret of secrets) {
    const key = decodeWhsecKey(secret);
    if (!key) continue;
    const computed = createHmac("sha256", key)
      .update(signed, "utf8")
      .digest("base64");
    for (const sig of provided) {
      if (safeEq(computed, sig)) return true;
    }
  }
  return false;
}

/**
 * Legacy OpenPhone header: `hmac;1;<timestamp>;<base64sig>`.
 * Signed data is `<timestamp>.<body>`; key is base64-decoded secret.
 */
export function verifyLegacyOpenPhoneSignature(
  rawBody: string,
  header: string | null | undefined,
  secrets: string[] = secretList(),
): boolean {
  if (!header) return false;

  const bodies = [rawBody];
  try {
    bodies.push(JSON.stringify(JSON.parse(rawBody)));
  } catch {
    /* not JSON — raw only */
  }

  for (const secret of secrets) {
    // Skip whsec_ secrets for legacy path (wrong encoding).
    if (secret.startsWith("whsec_")) continue;
    const keyRaw = Buffer.from(secret, "base64");
    const keys = [keyRaw, Buffer.from(keyRaw.toString("binary"), "utf8")];

    for (const sig of header.split(",")) {
      const fields = sig.trim().split(";");
      if (fields.length < 4) continue;
      const timestamp = fields[2];
      const provided = fields[3];
      for (const body of bodies) {
        const signed = `${timestamp}.${body}`;
        for (const key of keys) {
          const computed = createHmac("sha256", key)
            .update(signed, "utf8")
            .digest("base64");
          if (safeEq(computed, provided)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Verify Quo/OpenPhone webhook: accept either current whsec_ scheme or legacy
 * openphone-signature. Unset secret accepts only outside production (local dev).
 */
export function verifyOpenPhoneSignature(
  rawBody: string,
  headers: QuoWebhookHeaders | string | null,
): boolean {
  const secretRaw = openPhoneWebhookSecret();
  if (!secretRaw) {
    return process.env.NODE_ENV !== "production";
  }

  const h: QuoWebhookHeaders =
    typeof headers === "string" || headers === null
      ? { openphoneSignature: headers }
      : headers;

  const secrets = secretList();

  if (
    verifyQuoWhsecSignature(
      rawBody,
      h.webhookId,
      h.webhookTimestamp,
      h.webhookSignature,
      secrets,
    )
  ) {
    return true;
  }

  return verifyLegacyOpenPhoneSignature(
    rawBody,
    h.openphoneSignature ?? null,
    secrets,
  );
}
