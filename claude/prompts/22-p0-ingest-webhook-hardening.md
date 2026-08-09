# Prompt 22 — P0: Ingest + webhook reliability and security hardening

**Priority: do this first.** Every item below is a confirmed defect in code that is already live and internet-facing. No new features, no new models, no UI. Read `AGENTS.md` §5, §6, §9 before starting. Keep every change minimal and surgical.

Do **not** refactor anything not listed here. Do **not** introduce tRPC, `server/`, or `services/` (AGENTS.md §4).

---

## 1. FATAL — a single transient PII-DB init failure bricks all ingest for the life of the process

`src/lib/prisma-pii.ts:85`

```ts
function getClient(): Promise<PrismaClient> {
  return (g.piiClientPromise ??= createClient());
}
```

`??=` memoizes the **promise**. A rejected promise is not nullish, so it is cached forever. `createClient()` awaits `resolvePiiUrl()`, which on Vercel makes a live `SecretsManagerClient.send()` call. One Secrets Manager throttle, one OIDC blip, one momentarily-unset `AWS_ROLE_ARN` → every subsequent `prismaPii.*` call on that instance rejects with the same stale error until the container recycles. `isPiiConfigured()` still returns `true`, so none of the graceful-degradation paths in `lead-handler.ts` or `crm/queries.ts` fire — `/api/v1/leads`, `/api/webhooks/openphone`, `/clients`, `/leads` and `/call-log` all 500.

**Fix:** clear the cached promise on rejection so the next call retries.

```ts
function getClient(): Promise<PrismaClient> {
  if (!g.piiClientPromise) {
    g.piiClientPromise = createClient().catch((err) => {
      g.piiClientPromise = undefined;
      throw err;
    });
  }
  return g.piiClientPromise;
}
```

Make sure the global type allows `undefined`.

---

## 2. FATAL — webhook signature verification fails **open** when the secret is missing

`src/lib/openphone.ts:172-175`

```ts
const secretRaw = openPhoneWebhookSecret();
if (!secretRaw) {
  return process.env.NODE_ENV !== "production";
}
```

`src/features/phone/openphone-webhook.ts:412` only hard-fails (503) when `NODE_ENV === "production"`. So any deployed environment where `NODE_ENV` is not exactly `production` — a staging box, a container that drops the var, a tunneled `next dev` used for Quo testing — accepts **completely unsigned** POSTs on the public `/webhooks/openphone` and `/api/webhooks/openphone`. An anonymous caller can then write arbitrary `PhoneEvent` rows and, via `upsertMatchedActivity`, arbitrary `Activity` rows attached to real `Customer` / `Contact` / `Lead` records in the PII database, with attacker-chosen phone numbers and body text.

**Fix:** fail closed unconditionally. Gate the dev bypass on an explicit opt-in env var, never on `NODE_ENV`.

```ts
const secretRaw = openPhoneWebhookSecret();
if (!secretRaw) {
  return process.env.ALLOW_UNSIGNED_QUO_WEBHOOKS === "1";
}
```

Update `src/features/phone/openphone-webhook.ts:412` to 503 whenever no secret is configured **and** `ALLOW_UNSIGNED_QUO_WEBHOOKS !== "1"`. Add `ALLOW_UNSIGNED_QUO_WEBHOOKS` to `.env.example` with a comment that it must never be set in any deployed environment.

---

## 3. HIGH — legacy signature path has no timestamp window; signatures replay forever

`src/lib/openphone.ts:125-162` — `verifyLegacyOpenPhoneSignature` reads `fields[2]` as the timestamp only to build the signed string, and never compares it to now. `src/lib/openphone.test.ts:66` proves it: the test asserts `true` for `timestamp = "1710000000"` (March 2024). `verifyQuoWhsecSignature` (`:89-93`) correctly enforces ±5 minutes. Because `verifyOpenPhoneSignature:196` falls back to the legacy verifier whenever the whsec check fails, this is reachable in production.

**Fix:** apply the same ±5-minute skew check to the legacy path. Update `openphone.test.ts:66` to use a fresh timestamp and add a test asserting an old timestamp is rejected.

Also at `:132-137`: `bodies.push(JSON.stringify(JSON.parse(rawBody)))` verifies the signature against a **re-serialized** body, so the accepted bytes need not be the signed bytes. Drop that fallback — verify the raw body only.

---

## 4. HIGH — `upsertEvent` / `upsertMatchedActivity` are read-then-write, not upserts

`src/features/phone/openphone-webhook.ts:89-127` and `src/features/phone/match-target.ts:70-95` do `findUnique({ where: { externalId } })` → branch → `create(...)`. Both `PhoneEvent.externalId` and `Activity.externalId` are `@unique`.

Quo emits `call.completed`, `call.recording.completed`, `call.voicemail.completed` and `call.summary.completed` for the same call id within milliseconds, and **two routes** are registered for the same handler (item 8), so the same event can land twice concurrently. Both `findUnique` return null, both `create`, one throws P2002 → caught at `openphone-webhook.ts:444` → `500 {"error":"processing failed"}` → Quo retries. Under load this is a 500 storm. `mergeBody` also loses updates (last writer wins, silently dropping the other event's "Summary:" or "Transcript:" line).

**Fix:**
- Replace both with real `prismaPii.phoneEvent.upsert({ where: { externalId }, create, update })` / `prismaPii.activity.upsert(...)`.
- In the catch at `openphone-webhook.ts:444`, treat Prisma error code `P2002` as success and return **200** — a duplicate delivery is not an error.
- For the `body` merge, do the merge inside the `update` branch of the upsert so concurrent writers converge instead of clobbering.

---

## 5. HIGH — unparseable date → permanent 500 → infinite retry loop

`src/features/phone/openphone-webhook.ts:142`

```ts
const when = (s?: string) => (s ? new Date(s) : new Date());
```

A non-empty, non-ISO `createdAt`/`completedAt` yields `Invalid Date`, which is written to the non-null `occurredAt` column. Prisma throws → 500 → Quo retries the identical payload → 500 again, deterministically, until retries exhaust and the event is lost.

**Fix:**

```ts
const when = (s?: string) => {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
```

---

## 6. HIGH — internal exception text returned to the public internet

`src/features/ingress/lead-handler.ts:219`

```ts
return { ok: false, status: 500, error: `Lead create failed: ${message}` };
```

`src/app/api/v1/leads/route.ts:31-34` forwards `result.error` verbatim. Prisma errors carry table names, column names, constraint names, and for connection failures the Neon host / database / user. The uncaught-throw path at `route.ts:41-47` already does this correctly ("Ingest failed") — the handler path bypasses it.

**Fix:** `console.error` the detail server-side, return the fixed string `"Ingest failed"` to the caller.

---

## 7. HIGH — empty-string `divisionSlug` drops every lead from that form

`src/features/ingress/lead-handler.ts:154`

```ts
let divisionSlug = data.divisionSlug ?? company.crm.defaultLeadDivisionSlug;
```

`divisionSlug` is `z.string().optional()` with no `.min(1)` / `.trim()`. `??` only falls back on `null` / `undefined`. A marketing form with a hidden or optional `divisionSlug` input serializing as `""` (the normal `FormData` → JSON result) makes `division.findUnique({ where: { slug: "" } })` return null → `400 "Unknown division"` for **every** submission from that site. Same for stray whitespace.

**Fix:**

```ts
const slug = data.divisionSlug?.trim() || company.crm.defaultLeadDivisionSlug;
```

Add `.trim()` to the Zod field as well.

---

## 8. MEDIUM — deduplicate the two OpenPhone route files

`src/app/api/webhooks/openphone/route.ts` and `src/app/webhooks/openphone/route.ts` are byte-identical apart from a comment. The legacy path is intentional (it is what Quo is configured with), but any future hardening applied to one and not the other silently leaves an unhardened public endpoint.

**Fix:** make the legacy file a single re-export so there is exactly one implementation:

```ts
// src/app/webhooks/openphone/route.ts
/** Legacy Quo webhook URL still present in Quo config. Single implementation lives in /api/webhooks/openphone. */
export { POST, runtime, dynamic } from "@/app/api/webhooks/openphone/route";
```

Leave both entries in `src/proxy.ts`.

---

## 9. MEDIUM — first event with unresolvable parties permanently orphans the call

`src/features/phone/openphone-webhook.ts:94-108` — the "already exists" branch never backfills `partyNat`, `fromE164`, `toE164`, `kind` or `occurredAt`. If the first stored event for a call had a thin `data.context` so `resolveBetaParties` returned `{ externalRaw: null }`, `partyNat` stays `null` forever. Every later event for that call passes `existing.partyNat` (`:105`) into `upsertMatchedActivity`, so the call **never** attaches to the customer even once a later payload carries the number.

**Fix:** in the update branch, set `partyNat`, `fromE164`, `toE164` when the stored value is currently null and the incoming payload has one; then re-run `upsertMatchedActivity` with the newly resolved value.

---

## 10. MEDIUM — out-of-order summary events are dropped with a 200

`src/features/phone/openphone-webhook.ts:360-371` — `mergeSummaryOrTranscript` returns `"ignored:no_existing_call"` with HTTP **200** when the `PhoneEvent` row does not exist yet. Quo emits `call.summary.completed` asynchronously; if it lands before `call.completed`, the AI summary — the primary triage signal on `/call-log` — is dropped permanently with no retry.

**Fix:** create a placeholder `PhoneEvent` keyed on the call's `externalId` (kind = the call kind, `occurredAt` = now, `body` = the summary) so the later `call.completed` merges onto it. Item 9's backfill logic makes this safe.

---

## 11. MEDIUM — outbound Quo API call inside the webhook handler, with no timeout

`src/features/phone/openphone-webhook.ts:377` calls `fetchCallSummaryFromApi`, which uses `quoFetch`. `quoFetch` has **no** timeout (unlike `src/lib/geoapify.ts:141`, which sets `AbortSignal.timeout`) and tries two base hosts sequentially (`src/lib/quo-api.ts:47-60`). A slow Quo API stalls the webhook past the function limit → 504 → Quo retries → concurrent duplicate processing (item 4).

**Fix:** add `signal: AbortSignal.timeout(4000)` to `quoFetch` and treat a timeout as "no summary available" rather than an error. Keep the call in-request for now; note in a comment that enrichment should move out of the request path if it becomes slow.

---

## 12. MEDIUM — non-constant-time comparison of the shared ingest secret

`src/features/ingress/lead-handler.ts:157` — `headers.ingestSecret === serverSecret`. The adjacent `IngestKey` path correctly uses a SHA-256 hash lookup (`:166`), and `src/lib/openphone.ts:48-56` already has a `safeEq` helper using `timingSafeEqual`.

**Fix:** export `safeEq` (or add an equivalent local helper) and use it here.

---

## 13. MEDIUM — public lead endpoint has no body-size cap and no rate limit

`src/app/api/v1/leads/route.ts:19` does `await req.json()` with no size check; the Zod length caps only apply after the whole body is buffered. There is no rate limiting anywhere in `src/` (grepped for `rate.?limit|ratelimit|upstash|throttle` — zero hits). Every bogus `x-ingest-key` still costs one indexed query against `ingest_key`, and valid keys cost a `lastUsedAt` write — against the **same** PII pool that serves `/leads`, `/clients` and `/call-log` for staff.

**Fix (minimal, no new dependency):**
- Reject before parsing when `Content-Length` is missing or `> 32_768`, with a 413.
- Add a simple in-memory fixed-window counter keyed by `x-ingest-key` (or client IP when absent) — e.g. 30 requests / 60s → 429. A module-level `Map` is acceptable here; add a comment that it is per-instance and should move to Redis/Upstash if abuse becomes real.
- Do **not** add a `lastUsedAt` write on failed key lookups.

---

## 14. MEDIUM — `proxy.ts` public-path matching is bare `startsWith`

`src/proxy.ts:18-20` — `/api/v1/leads` also matches `/api/v1/leadsfoo`; `/sign-in` matches `/sign-inX`; `/webhooks/openphone` matches `/webhooks/openphone-admin`. No route currently exists that this exposes, so it is a latent trap, not a live hole — but it becomes exploitable the moment someone adds `/api/v1/leads/[id]/route.ts`.

**Fix:**

```ts
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"),
  );
}
```

---

## 15. HIGH — auth config: two environment-safety gaps

`src/lib/auth.ts:30` passes `process.env.BETTER_AUTH_SECRET` straight through with no assertion. If the var is missing, Better Auth falls back to a built-in default rather than refusing to start — sessions get signed with a publicly known key and are forgeable.

**Fix:** throw at module load when it is unset.

```ts
const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is not set — refusing to start.");
}
```

`src/lib/auth.ts:12-21` appends `"http://localhost:3000"` and `"http://127.0.0.1:3000"` to `trustedOrigins` **unconditionally, in every environment**, so production accepts credentialed cross-origin requests from anything the victim runs on localhost:3000.

**Fix:** add those two entries only when `process.env.NODE_ENV !== "production"`.

---

## 16. Verify before changing — CORS on the lead endpoint

`src/app/api/v1/leads/route.ts` exports an `OPTIONS` handler advertising `Access-Control-Allow-Origin: *`, but the `POST` responses carry **no** CORS headers (and `next.config.mjs` adds none). If the marketing sites submit from the **browser**, the lead row is created and then the browser blocks the response for missing ACAO — the form shows "submission failed", the customer resubmits, and you get duplicate leads with no visible error.

`claude/prompts/19-marketing-lead-form-standard.md` says forms send `x-ingest-secret`, which implies a **server-side** proxy on each marketing site — in which case CORS is irrelevant and the `OPTIONS` handler is vestigial.

**Do this:** confirm with Ryan how the three marketing sites actually submit before changing anything.
- If server-to-server: delete the `OPTIONS` handler and its CORS headers entirely — it is misleading dead code, and remove `x-ingest-key` from the advertised allow-list.
- If browser-submitted: add the same `Access-Control-Allow-Origin` to **every** POST response path (success and error), and change `*` to an explicit allow-list of the three marketing origins.

---

## Acceptance

- `npm run lint` and `npm run typecheck` clean.
- `npm run test:openphone` passes, with new cases for: missing secret → rejected; legacy signature older than 5 minutes → rejected.
- New test: a duplicate `externalId` delivery returns 200, not 500.
- New test: `handleLeadIngest` with `divisionSlug: ""` routes to the default division instead of 400.
- Manual: replay a real Quo `call.completed` payload twice in quick succession; both return 200 and exactly one `PhoneEvent` row exists.
