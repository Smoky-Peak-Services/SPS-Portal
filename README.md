# SPS Portal 2.0

Fresh rebuild of the Smoky Peak Services portal. Current baseline: invite-only login + empty dashboard shell + public lead ingest. Field Ops / CRM are rebuilt next in a structured pass.

## Architecture

- **Node 24** Active LTS · **Next.js 16** App Router · React 19 · TypeScript 5 · Tailwind 3
- **Dual Neon Postgres**: ops (auth, divisions, invitations) + PII (leads, ingest keys)
- **Better Auth** — invite-only email/password
- **Company config** — `src/config/company.ts` is the clone-via-config single source of truth
- **Feature folders** — today: `auth`, `ingress`, `cron`, `accounting` (schema guard). Domain folders return as each phase lands.

## Right to erasure

Lead (and future customer) identity lives only in the PII database. Retention windows are in `company.retention`. The purge stub (`src/features/cron/purge-run.ts`) documents the erase path; wire a cron when ready.

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

| File                  | Purpose                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `.env.local`          | Local secrets (gitignored). Includes `PII_*`, seed vars                               |
| `.env.vercel`         | Upload/sync to Vercel (gitignored). No raw PII URLs, no Stripe secret, no Upstash yet |
| `.env.vercel.example` | Key-name template safe to commit                                                      |
| `.env.example`        | Documented key names                                                                  |

```powershell
powershell -File scripts/sync-vercel-env.ps1 -EnvFile .env.vercel `
  -Keys OPS_DATABASE_URL,OPS_DIRECT_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,NEXT_PUBLIC_APP_URL,CLIENT_DB_SECRET_ARN,AWS_ROLE_ARN,AWS_REGION
```

### Vercel PII (Secrets Manager + OIDC)

Production portal resolves Neon PII via `CLIENT_DB_SECRET_ARN` (same `sps/clients-db/*` secret as the original SPS Portal) using Vercel OIDC (`AWS_ROLE_ARN`, `AWS_REGION=us-east-2`). Do **not** set raw `PII_DATABASE_URL` on Vercel.

1. Enable OIDC on the Portal 2.0 Vercel project (`sps-portal`) and ensure role `VercelPortalPaymentsInvoke` trust allows:
   `owner:ryank-3313s-projects:project:sps-portal:environment:production`
   (repo copy: original SPS Portal `aws/payments/iam/trust-policy.json`). The IAM user `Smoky_Peak_Services` cannot update trust policies — use the AWS Console as an admin/root, or temporarily widen that user’s IAM permissions.
2. Set `CLIENT_DB_SECRET_ARN`, `AWS_ROLE_ARN`, and `AWS_REGION` on Vercel (copy values from the original portal).
3. Smoke: `POST /api/v1/leads` with a valid ingest key/secret should not return `503` / `pii_unconfigured` or OIDC `AccessDenied`.

Locally, keep using `PII_DATABASE_URL` / `PII_DIRECT_URL` for seed and migrate. `isPiiConfigured()` is true when either the local URL or the ARN is set.

### Local AWS CLI profiles

Smoky Peak account **`084000526828`** must be the AWS CLI **`[default]`** profile (`us-east-2`). The Altitude Network / cousin account (`501804115142`) lives under profile **`altitude`** (`us-west-1`):

```powershell
aws sts get-caller-identity
# Expect Account: 084000526828

aws sts get-caller-identity --profile altitude
# Expect Account: 501804115142
```

Do not commit access keys. Keys for local CLI ops can live in `.env.local` (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) and/or `~/.aws/credentials`.

## PWA

Installable standalone app (browser “Install” / Add to Home Screen). Service worker registers in production only.

## Portal routes (current)

| Route                | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `/sign-in`           | Invite-only sign-in                            |
| `/`                  | Empty dashboard shell                          |
| `/account`           | Profile                                        |
| `/clients`           | CRM client profiles (desktop)                  |
| `/materials`         | Materials catalog admin (desktop, admin/staff) |
| `POST /api/v1/leads` | Public lead ingest (PII)                       |
