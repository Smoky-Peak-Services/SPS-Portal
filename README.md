# SPS Portal 2.0

Fresh rebuild of the Smoky Peak Services portal. Phase 1: buildable base + Field Ops shell.

## Architecture

- **Node 24** Active LTS · **Next.js 16** App Router · React 19 · TypeScript 5 · Tailwind 3
- **Dual Neon Postgres**: ops (staff, jobs, tickets, auth) + PII (customers, leads, locations)
- **Better Auth** — invite-only email/password
- **Company config** — `src/config/company.ts` is the clone-via-config single source of truth
- **Feature folders** — `src/features/{jobs,tickets,schedule,crm,ingress}`

Ops tables store `customerId` / `propertyId` as plain strings (no cross-DB FKs). Display names are joined via `src/lib/pii-join.ts`.

## Right to erasure

Customer identity lives only in the PII database. Retention windows are in `company.retention`. The purge stub (`src/features/cron/purge-run.ts`) documents the erase path; wire a cron when ready.

Public marketing forms ingest into PII via `POST /api/v1/leads` (per-division `IngestKey`).

## Money path later (deliberate non-goals)

Do **not** port the v1 tax tangle yet:

- No custom TN tax engine / de-minimis / use-tax accruals
- No Stripe invoice push / payments Lambda
- No QuickBooks sync

**Future contract:** Stripe Tax is the single calculator at charge time. The portal only classifies line tax codes. QuickBooks stays AP handoff until proven. No second estimate-time tax authority until classification is stable.

## Getting started

Requires **Node 24.x** (see `.nvmrc` / `package.json` engines).

```bash
# nvm use   # or install Node 24 Active LTS
cp .env.example .env.local   # fill OPS_* (and optionally PII_*) + BETTER_AUTH_SECRET
npm install
npm run db:push              # ops schema
npm run db:push:pii          # pii schema (or same DB in monolith mode)
npm run db:seed
npm run dev
```

Build check:

```bash
npm run build
npm run typecheck
```

## Env: local vs Vercel

| File | Purpose |
|------|---------|
| `.env.local` | Local secrets (gitignored). Includes `PII_*`, seed vars |
| `.env.vercel` | Upload/sync to Vercel (gitignored). No raw PII URLs, no Stripe secret, no Upstash yet |
| `.env.vercel.example` | Key-name template safe to commit |
| `.env.example` | Documented key names |

```powershell
powershell -File scripts/sync-vercel-env.ps1 -EnvFile .env.vercel `
  -Keys OPS_DATABASE_URL,OPS_DIRECT_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,NEXT_PUBLIC_APP_URL
```

Until `CLIENT_DB_SECRET_ARN` is wired, CRM customer joins on Vercel need local/monolith PII or a temporary ops=pii setup.

## PWA

Installable standalone app (browser “Install” / Add to Home Screen). Service worker registers in production only.

## Mobile vs desktop surfaces

Same codebase. Mobile surfaces: My Day, Jobs, Tickets, Schedule, Account. Desktop-only: Dashboard, Clients, create job/ticket forms.

## Field Ops (phase 1)

| Route | Purpose |
|-------|---------|
| `/jobs` | Jobs CRUD |
| `/tickets` | Service tickets |
| `/schedule` | Week list + assign tech |
| `/field/today` | My Day |
| `/clients` | Minimal CRM (PII) — desktop |
