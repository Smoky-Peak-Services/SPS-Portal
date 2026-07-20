# Smoky Peak ERP: Architecture and Folder Structure

> Companion to `project-context.md`. That file says what we are building and why. This file says how the code is laid out and how a request or event flows through it. Read this before adding a file so it lands in the right layer.

---

## 1. The one idea to hold in your head

Code is organized in rings. The outside ring is thin, the core ring is thick, and dependencies only point inward.

```
        UI / HTTP entry   (app/, components/, webhooks)     <- thin, no business rules
              |
        Typed API surface (server/ tRPC routers)            <- thin, validates + authorizes
              |
   >>>  BUSINESS LOGIC  (services/)  THE BOUNDARY  <<<       <- thick, all the real rules
              |
        Infra clients     (lib/: db, stripe, r2, ses, ...)  <- configured tools, no rules
              |
        Data + external   (Neon, Stripe, R2, QBO, Bedrock)
```

The rule that makes this work: **only `services/` contains business logic, and everything reaches the outside world through `services/`.** A page, a tRPC router, and a Lambda consumer are all just doors into the same `services/` layer. That is why the same rule cannot be implemented two different ways in two places. There is one place.

Import direction is strict:
- `app/` and `server/` may import from `services/` and `lib/`.
- `services/` may import from `lib/` and `prisma` types. It must **not** import from `app/` or `server/`.
- `lib/` imports nothing from `services/`, `server/`, or `app/`. It is leaf-level.

If you follow that one direction, the whole thing stays testable and the business logic stays liftable into other runtimes (see Section 6).

---

## 2. The annotated tree

Your skeleton is preserved. Everything new is explained.

```
smoky-peak-erp/
├── project-context.md            # what and why (the other doc)
├── ARCHITECTURE.md               # this file: how it is laid out
├── .cursorrules                  # always-on rules for the AI agent
├── middleware.ts                 # division / tenant routing at the edge (vercel/platforms pattern)
│
├── prisma/
│   ├── schema.prisma             # THE data model. single source of truth. Neon Postgres.
│   └── migrations/               # generated migration history
│
├── src/
│   ├── app/                      # PRESENTATION + HTTP ENTRY. keep thin.
│   │   ├── (public)/             # marketing / unauthenticated pages
│   │   ├── dashboard/            # the authenticated app
│   │   │   ├── quotes/           # quote / ticket builder UI
│   │   │   ├── jobs/             # job list, detail, status
│   │   │   ├── dispatch/         # dispatch board, scheduling
│   │   │   ├── invoicing/        # invoice review and send
│   │   │   └── costing/          # cost vs estimate views
│   │   └── api/                  # HTTP endpoints. thin adapters only.
│   │       ├── auth/[...all]/route.ts     # Better Auth handler
│   │       ├── trpc/[trpc]/route.ts       # tRPC over HTTP handler
│   │       └── webhooks/
│   │           ├── stripe/route.ts        # verify signature, then emit to EventBridge
│   │           └── strmagic/route.ts      # inbound marketplace jobs. arms-length. see note.
│   │
│   ├── components/               # PURE UI. no data fetching logic, no business rules.
│   │   ├── ui/                   # shadcn / Radix primitives
│   │   └── domain/               # composed components (JobCard, QuoteLineRow, etc.)
│   │
│   ├── server/                   # TYPED API SURFACE (tRPC). thin controllers.
│   │   ├── trpc.ts               # tRPC init, context creation, auth + tenant middleware
│   │   └── routers/
│   │       ├── _app.ts           # root router that stitches the rest together
│   │       ├── quote.ts          # validates input, checks perms, calls services/quoting
│   │       ├── job.ts
│   │       ├── dispatch.ts
│   │       └── invoice.ts
│   │
│   ├── services/                 # >>> THE BOUNDARY <<< all business logic lives here.
│   │   ├── tax/
│   │   │   └── taxEvaluator.ts   # resolves the Stripe tax code per line item
│   │   ├── quoting/
│   │   │   ├── quoteBuilder.ts   # assemblies, options, margin
│   │   │   └── quoteToJob.ts     # convert won quote to job with zero re-entry
│   │   ├── jobs/
│   │   │   ├── jobLifecycle.ts   # status transitions, emits domain events
│   │   │   └── costing.ts        # labor + material + equipment vs estimate
│   │   ├── billing/
│   │   │   ├── invoicing.ts      # builds Stripe invoices from job lines + tax codes
│   │   │   └── qboMapper.ts      # maps a settled Stripe object into QBO entries
│   │   ├── dispatch/
│   │   │   └── scheduler.ts      # availability, assignment
│   │   └── notifications/
│   │       └── notifier.ts       # orchestrates SES email + Quo SMS/voice
│   │
│   ├── lib/                      # INFRASTRUCTURE CLIENTS + CONFIG. no business rules.
│   │   ├── auth.ts               # Better Auth configuration
│   │   ├── db.ts                 # Prisma client (Neon). THE database lives here, not aws.ts.
│   │   ├── stripe.ts             # Stripe SDK wrapper
│   │   ├── r2.ts                 # Cloudflare R2 (S3-compatible) client
│   │   ├── quo.ts                # Quo (formerly OpenPhone) client
│   │   ├── ses.ts                # AWS SES client
│   │   ├── events.ts            # AWS EventBridge putEvents wrapper
│   │   ├── secrets.ts           # AWS Secrets Manager loader
│   │   ├── bedrock.ts           # AWS Bedrock client
│   │   └── aws.ts               # shared AWS SDK credential + region config (NOT the DB)
│   │
│   └── types/                    # shared zod schemas and TS types used across layers
│
└── functions/                    # AWS LAMBDA CONSUMERS (see Section 6 on where these live)
    ├── on-job-complete/          # reacts to job.completed -> services/billing/invoicing
    ├── on-stripe-settled/        # reacts to Stripe settled -> services/billing/qboMapper
    └── on-vendor-pdf/            # reacts to upload -> services/... via lib/bedrock
```

### Why `db.ts` is separate from `aws.ts`

Your database is Neon Postgres, reached through Prisma. That is not an AWS service. `db.ts` holds the Prisma client. `aws.ts` holds only the shared AWS SDK config (region, credentials from Secrets Manager) that SES, EventBridge, and Bedrock share. Keeping them separate means swapping a database or an AWS service never touches the other.

### The `strmagic` webhook note

`webhooks/strmagic/route.ts` is the one seam to STR Magic. It receives marketplace jobs where Smoky Peak is acting as a vendor. Treat everything it receives as untrusted external input: verify the signature, validate the payload, and create a normal work order through `services/`. No shared database, no shared secrets, no implicit trust.

---

## 3. What each layer is allowed to do

| Layer | Job | Allowed to | Never |
|---|---|---|---|
| `app/` pages | render UI | read from server components, call tRPC | contain business rules |
| `app/api/webhooks` | receive external events | verify, parse, hand off to services or emit an event | compute business outcomes inline |
| `server/routers` | typed controllers | validate input (zod), check permissions and tenant, call services | run business logic itself |
| `services/` | the rules | orchestrate logic, call lib clients, read/write via db | know about HTTP, tRPC, or React |
| `lib/` | tools | expose a configured client | contain any business decision |

If you ever want to write an `if` that encodes a business rule, it goes in `services/`. If you catch yourself writing tax logic in a router or a page, move it.

---

## 4. Worked trace: a job goes complete

This is the whole point of the layering. Follow one action end to end.

1. Technician taps **Complete** in `app/dashboard/jobs/`.
2. The UI calls `job.markComplete` on the tRPC router in `server/routers/job.ts`.
3. The router validates the input, confirms the user's division and permission, then calls `services/jobs/jobLifecycle.markComplete(jobId, ctx)`.
4. `jobLifecycle` updates job status through `lib/db.ts`, then emits a `job.completed` domain event through `lib/events.ts` (EventBridge). It does **not** create the invoice inline. It announces the fact and returns.
5. EventBridge routes `job.completed` to the `functions/on-job-complete` Lambda.
6. That Lambda calls the **same** `services/billing/invoicing.ts`. Invoicing pulls the job lines, and for each line asks `services/tax/taxEvaluator.ts` for the correct Stripe tax code, then creates the invoice through `lib/stripe.ts`.
7. Customer pays. Stripe fires a webhook to `app/api/webhooks/stripe`. That route verifies the signature and emits a `stripe.settled` event through `lib/events.ts`.
8. EventBridge routes it to `functions/on-stripe-settled`, which calls `services/billing/qboMapper.ts` to push a clean entry to QuickBooks. One direction, settled data only.

Notice step 6 and the web app both enter through `services/`. The button click and the Lambda run the identical billing and tax logic because there is one implementation.

---

## 5. Worked trace: resolving tax on a line

Your `taxEvaluator` is the sharpest example of why the boundary matters, because it encodes real liability.

1. `invoicing.ts` builds invoice lines from a quote or job.
2. For each line it calls `taxEvaluator.resolve(line, context)`.
3. `taxEvaluator` reads the line's classification (from the catalog: is this a realty improvement, tangible personal property, a service, an alarm or access-control component), applies the contract context and Tennessee rules (realty vs TPP, fixture treatment, single-article banding), and returns a single Stripe tax code.
4. `invoicing.ts` attaches that code to the Stripe line. It does not compute tax. Stripe's engine computes the liability from the code and jurisdiction.

The ERP never calculates tax amounts. It decides the classification and hands Stripe the code. That keeps multi-jurisdiction correctness out of your codebase and in Stripe, and it keeps all the classification rules in one auditable file.

---

## 6. The one structural decision to make now

Your skeleton is a single Next.js app. That is the clearest way to start and to learn the layering. There is one thing that forces a decision, and it is worth understanding rather than stumbling into.

The Lambda consumers in `functions/` need the **same** `services/` and `lib/` code the web app uses (see the trace in Section 4). You have two ways to make that sharing clean:

**Option A: single repo (start here).**
Keep everything as shown. Deploy the Next.js app to Vercel. Deploy the `functions/` Lambdas separately, bundling in the `services/` and `lib/` code they need with esbuild. This works and is simple to reason about. The discipline that keeps it clean: never let `services/` import from `app/` or `server/`. If that rule holds, the business logic has no web dependencies and bundles cleanly into a Lambda.

**Option B: Turborepo monorepo (the clean evolution).**
When the shared-code bundling gets annoying, lift the inner rings into packages:

```
apps/
  web/        # the Next.js app (app/, components/, server/)
  workers/    # the AWS Lambda consumers
packages/
  core/       # services/  (the business logic, shared)
  db/         # prisma schema + client (shared)
  clients/    # lib/ infra clients (shared)
```

Now `apps/web` and `apps/workers` both depend on `packages/core`, and the "one implementation" guarantee is enforced by the package boundary instead of by discipline. You already run Turborepo on STR Magic, so this is familiar ground.

**Recommendation:** start with Option A so the mental model stays simple while you build the core, but write `services/`, `lib/`, and `prisma/` as if they were already packages: no imports pointing outward, no HTTP or React types leaking in. Done that way, the move to Option B is mechanical when you need it, not a rewrite.

---

## 7. Quick placement guide

When you are about to add a file and are not sure where it goes:

- It renders something a user sees. `app/` or `components/`.
- It defines an API endpoint the client calls. `server/routers/`.
- It receives an event from Stripe or STR Magic. `app/api/webhooks/`.
- It decides something (pricing, tax, status, eligibility, scheduling). `services/`.
- It is a configured connection to an outside system. `lib/`.
- It reacts to a domain event in the background. `functions/`.
- It describes the shape of data. `prisma/schema.prisma` for persisted data, `src/types/` for transient shapes.
