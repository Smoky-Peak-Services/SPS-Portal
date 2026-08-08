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
| `/leads/[id]` | Detail, status, notes, promote |
| `/call-log` | Last 14 days PhoneEvents, dismiss, triage |
| `POST /webhooks/openphone` | Public Quo webhook (HMAC; legacy URL Quo uses) |
| `POST /api/webhooks/openphone` | Same handler (alternate path) |

Desktop-only. Capabilities: `crm.access` / `crm.write` / `crm.archive` (reuse).

## Feature code

- `src/features/phone/` — webhook, payload parse, match-target, call-log queries/UI
- `src/features/crm/` — lead list/detail actions, promote, schemas
- `src/lib/openphone.ts`, `src/lib/phone-parse.ts`, `src/lib/phone-format.ts`

## Env

- `OPENPHONE_WEBHOOK_SECRET` (or `OP_WEBHOOK_SECRET`) — base64 signing key from Quo; comma-separated for multiple keys. Required in production on Vercel.
- Quo webhook URL: `https://portal.smokypeak.tech/webhooks/openphone` (also `/api/webhooks/openphone`).

## Non-goals

- Outbound Quo SMS API, proposal nudges, AWS Lambda ingress cutover
- Emergency circuit breaker / on-call payroll
- Auto PHONE Lead creation for unknown callers
- Quote / Job / Ticket from CRM

## Tests

- `npm run test:phone` — payload + match helpers
- `npm run test:schema-guard` after PII schema changes
