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

export function openPhoneWebhookSecret(): string {
  return (
    process.env.OPENPHONE_WEBHOOK_SECRET ??
    process.env.OP_WEBHOOK_SECRET ??
    ""
  ).trim();
}

function safeEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Verify an OpenPhone / Quo webhook signature.
 *
 * Header format: `hmac;1;<timestamp>;<base64sig>`. Signed data is
 * `<timestamp>.<body>`; signing key is base64-decoded from
 * OPENPHONE_WEBHOOK_SECRET ("Reveal signing secret" in Quo).
 *
 * If the secret is unset we accept only outside production (local dev).
 */
export function verifyOpenPhoneSignature(
  rawBody: string,
  header: string | null,
): boolean {
  const secretRaw = openPhoneWebhookSecret();
  if (!secretRaw) {
    return process.env.NODE_ENV !== "production";
  }
  if (!header) return false;

  const secrets = secretRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const bodies = [rawBody];
  try {
    bodies.push(JSON.stringify(JSON.parse(rawBody)));
  } catch {
    /* not JSON — raw only */
  }

  for (const secret of secrets) {
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
