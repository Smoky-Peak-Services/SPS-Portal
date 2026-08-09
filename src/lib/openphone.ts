import "server-only";
import {
  verifyOpenPhoneSignatureWithSecrets,
  type QuoWebhookHeaders,
} from "@/lib/openphone-signature";

export {
  isQuoResourceId,
  isValidUsNational10,
  parseUsPhone,
  toE164,
  phoneNational,
  phoneNat10,
  phoneForStorage,
  type ParsedUsPhone,
} from "@/lib/phone-parse";

export {
  decodeWhsecKey,
  safeEq,
  verifyLegacyOpenPhoneSignature,
  verifyQuoWhsecSignature,
  verifyOpenPhoneSignatureWithSecrets,
  type QuoWebhookHeaders,
} from "@/lib/openphone-signature";

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

function secretList(): string[] {
  return openPhoneWebhookSecret()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Verify Quo/OpenPhone webhook: accept either current whsec_ scheme or legacy
 * openphone-signature. Missing secret fails closed unless
 * ALLOW_UNSIGNED_QUO_WEBHOOKS=1 (local only — never set in deploy).
 */
export function verifyOpenPhoneSignature(
  rawBody: string,
  headers: QuoWebhookHeaders | string | null,
): boolean {
  return verifyOpenPhoneSignatureWithSecrets(
    rawBody,
    headers,
    secretList(),
    process.env.ALLOW_UNSIGNED_QUO_WEBHOOKS === "1",
  );
}
