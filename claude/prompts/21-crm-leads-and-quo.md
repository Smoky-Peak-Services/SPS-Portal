# Prompt 21 — CRM Leads + Quo (hybrid)

## Goal

Lead inbox for website-ingested and manual leads, promote-to-customer, and Quo (OpenPhone) webhooks that feed a Call Log plus CRM Activity when a number already matches.

## Decisions

- **Hybrid phone model:** every Quo event upserts PII `PhoneEvent`. When the external party matches a Contact (preferred) or open Lead (status not WON/LOST/DISQUALIFIED) by last-10 digits, also upsert `Activity` by `externalId` (`CALL` / `SMS`). No auto-create PHONE Lead for unknowns.
- Website ingest (`POST /api/v1/leads`, prompt 19) is unchanged; those leads appear in `/leads`.

## Routes

| Path | Purpose |
|------|---------|
| `/leads` | Active pipeline (Inquiry → Approved) |
| `/leads/new` | Manual lead (Call Log triage prefills `?phone=&message=`) |
| `/leads/archive` | Won / Lost / Disqualified |
| `/leads/[id]` | Detail, status, notes, promote, delete |
| `/call-log` | Last 14 days PhoneEvents, dismiss spam, triage |
| `POST /webhooks/openphone` | Public Quo webhook (preferred URL) |
| `POST /api/webhooks/openphone` | Same handler (alternate path) |

Desktop-only. Capabilities: `crm.access` / `crm.write` / `crm.archive` (reuse).

## Feature code

- `src/features/phone/` — webhook, payload parse, match-target, call-log queries/UI
- `src/features/crm/` — lead list/detail actions, promote, schemas
- `src/lib/openphone.ts` — dual signature verify (Quo `whsec_` + legacy OpenPhone)
- `src/lib/quo-api.ts` — register webhooks / fetch summaries
- `src/lib/phone-parse.ts`, `src/lib/phone-format.ts`

## Quo setup (required for Call Log)

1. Deploy portal with dual signature verify + `/webhooks/openphone` public.
2. Register webhooks (uses `OP_API_KEY`):

```bash
npm run register:quo-webhooks
# optional smoke: npm run register:quo-webhooks -- --test message.received
```

3. Copy the printed `whsec_…` key into `.env.local` as `OP_WEBHOOK_SECRET`, then sync + redeploy:
   `npm run sync:quo-webhook-secret` → `npx vercel --prod` → `npm run verify:quo-webhooks -- <webhookId>`
   (A stale legacy secret on Vercel causes Quo deliveries to return `401 bad signature`.)
4. Quo webhook URL: `https://portal.smokypeak.tech/webhooks/openphone`
5. Events subscribed: `call.completed`, `call.missed`, `call.voicemail.completed`, `call.recording.completed`, `call.summary.completed`, `call.transcript.completed`, `message.received`.

Signature schemes accepted:

- **Current Quo:** headers `webhook-id`, `webhook-timestamp`, `webhook-signature` (`v1,<base64>`) with `whsec_…` key ([docs](https://www.quo.com/docs/2026-03-30/webhooks-signature-validation))
- **Legacy OpenPhone:** `openphone-signature` / `hmac;1;<ts>;<sig>`

## Env

- `OP_API_KEY` / `OPENPHONE_API_KEY` — register webhooks + optional summary enrich
- `OP_PHONE_NUMBER` / `SERVICE_PHONE` — workspace number for PN matching
- `OP_WEBHOOK_SECRET` / `OPENPHONE_WEBHOOK_SECRET` — `whsec_…` from register script (or legacy base64). Required in production on Vercel.
- `OP_API_WEBHOOK_URL` — optional override for register script URL

## Non-goals

- Outbound Quo SMS send UI, proposal nudges, AWS Lambda ingress cutover
- Auto PHONE Lead creation for unknown callers
- Full historical backfill via list-calls (API requires known participant)
- Quote / Job / Ticket from CRM

## Tests / verify

- `npm run test:phone` — payload + match + signature helpers
- Deploy → register → set `whsec_` on Vercel → Quo test event → row on `/call-log`
- Dismiss spam → gone; no Lead created
