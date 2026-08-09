/**
 * Quo / OpenPhone webhook signature verification (no env / secrets loading).
 * Safe to unit-test without `server-only`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_SKEW_SEC = 5 * 60;

export type QuoWebhookHeaders = {
  /** Legacy OpenPhone: hmac;1;<ts>;<sig> */
  openphoneSignature?: string | null;
  /** Quo 2026 Svix-style */
  webhookId?: string | null;
  webhookTimestamp?: string | null;
  webhookSignature?: string | null;
};

/** Constant-time string compare (timingSafeEqual). */
export function safeEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function withinSkew(timestampSec: number): boolean {
  if (!Number.isFinite(timestampSec)) return false;
  const skewSec = Math.abs(Math.floor(Date.now() / 1000) - timestampSec);
  return skewSec <= SIGNATURE_SKEW_SEC;
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
  secrets: string[],
): boolean {
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const ts = Number(webhookTimestamp);
  if (!withinSkew(ts)) return false;

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
 * Signed data is `<timestamp>.<rawBody>` only (no re-serialized JSON fallback).
 */
export function verifyLegacyOpenPhoneSignature(
  rawBody: string,
  header: string | null | undefined,
  secrets: string[],
): boolean {
  if (!header) return false;

  for (const secret of secrets) {
    if (secret.startsWith("whsec_")) continue;
    const keyRaw = Buffer.from(secret, "base64");
    const keys = [keyRaw, Buffer.from(keyRaw.toString("binary"), "utf8")];

    for (const sig of header.split(",")) {
      const fields = sig.trim().split(";");
      if (fields.length < 4) continue;
      const timestamp = fields[2];
      const provided = fields[3];
      const ts = Number(timestamp);
      if (!withinSkew(ts)) continue;

      const signed = `${timestamp}.${rawBody}`;
      for (const key of keys) {
        const computed = createHmac("sha256", key)
          .update(signed, "utf8")
          .digest("base64");
        if (safeEq(computed, provided)) return true;
      }
    }
  }
  return false;
}

/** Env-free combine of Quo + legacy verification (for tests and openphone.ts). */
export function verifyOpenPhoneSignatureWithSecrets(
  rawBody: string,
  headers: QuoWebhookHeaders | string | null,
  secrets: string[],
  allowUnsigned: boolean,
): boolean {
  if (secrets.length === 0) return allowUnsigned;

  const h: QuoWebhookHeaders =
    typeof headers === "string" || headers === null
      ? { openphoneSignature: headers }
      : headers;

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
