/**
 * Per-instance fixed-window counter for public lead ingest.
 * Not shared across Vercel instances — move to Redis/Upstash if abuse becomes real.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

type Bucket = { windowStart: number; count: number };

const buckets = new Map<string, Bucket>();

export function ingestRateLimitKey(
  ingestKey: string | null | undefined,
  clientIp: string | null | undefined,
): string {
  const key = (ingestKey ?? "").trim();
  if (key) return `key:${key}`;
  const ip = (clientIp ?? "").trim();
  return ip ? `ip:${ip}` : "ip:unknown";
}

/** Returns true when the request should be allowed. */
export function allowIngestRequest(bucketKey: string, now = Date.now()): boolean {
  const existing = buckets.get(bucketKey);
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(bucketKey, { windowStart: now, count: 1 });
    return true;
  }
  if (existing.count >= MAX_REQUESTS) {
    return false;
  }
  existing.count += 1;
  return true;
}

/** Test helper — clear in-memory buckets. */
export function resetIngestRateLimitForTests(): void {
  buckets.clear();
}
