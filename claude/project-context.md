# Smoky Peak ERP: Project Context and Objectives

> Working name. Drop this file at the root of the Cursor workspace as `project-context.md` or `README.md`. It is the source of truth for the AI agent: scope, stack, guardrails, and the reference material we model against. Keep it current. When a decision changes, change it here first.

---

## 1. Purpose of this document

This is the context and guardrail file for an AI-assisted build. It exists so any coding agent (or new engineer) can load one file and understand what we are building, why, what is locked in, what is out of bounds, and which battle-tested systems we borrow from instead of inventing.

Two rules for whoever reads this:

1. Do not invent architecture. If a proven pattern exists in the reference set below, adapt it. Novelty is a cost, not a feature.
2. Do not invent facts. Every open-source repo listed in Section 10 was verified to exist and be active. If you propose a new dependency or reference, verify it exists before recommending it. The prior version of this document listed five repositories that were entirely fabricated. That is the failure mode we are avoiding.

---

## 2. Executive summary

We are building a proprietary, vertically aligned ERP for **Smoky Peak Services LLC**, a multi-division contractor and service company. The platform unifies estimating and quoting, field service management and dispatch, job costing, resource scheduling, and financials into a single cloud-native environment.

We are not trying to out-feature ServiceTitan. We are taking the workflows that established platforms proved out, stripping the bloat, and fitting them to two divisions with genuinely different operating models. The system removes data silos, automates tax and liability treatment at the line-item level, and gives real-time operational and financial visibility across every division with global roll-up reporting.

Billing runs through Stripe as the source of truth. QuickBooks Online is the downstream ledger, fed from settled Stripe data so the books never fragment.

---

## 3. Scope and boundaries

### In scope: the two Smoky Peak divisions

This ERP serves the internal operations of Smoky Peak Services LLC:

1. **Smoky Peak Integrated Systems (SPIS)**: residential and commercial low-voltage integration. Access control, security, cameras, structured cabling. Project-based, complex assemblies, recurring monitoring and service agreements.
2. **Smoky Peak Cabin Services**: short-term-rental property maintenance and quick-turn support. Recurring maintenance plans plus on-demand dispatch.

### Out of scope: STR Magic

**STR Magic is a separate company and a separate codebase.** It is a hybrid SaaS marketplace connecting STR vendors, managers, and owners, with its own EIN, entity, and stack. It is not part of this ERP and must not share a database or auth boundary with it.

### The one seam that matters

STR Magic can dispatch work to Smoky Peak divisions the same way it dispatches to any vendor. When that happens, a job flows into this ERP through an external integration boundary (API or webhook), and Smoky Peak is treated as a vendor on that platform. Design the ERP's inbound job intake so an external marketplace order is a first-class source of work orders, but keep the two systems arms-length. No shared tables, no shared secrets, no implicit trust.

---

## 4. Division operating profiles (the real requirements driver)

The divisions look similar on the surface and diverge hard underneath. The data model must serve all three without forcing one division's shape onto the others.

| Dimension | Integrated Systems (SPIS) | Cabin Services |
|---|---|---|
| Primary work unit | Project or job with multi-line assemblies | Maintenance visit or quick-turn ticket |
| Sales cycle | Estimate, proposal, approval, install | Plan enrollment plus on-demand |
| Revenue shape | High-ticket project plus recurring SMA and monitoring | Recurring plan tiers plus per-visit |
| Estimating need | Heavy: assemblies, options, margin, part numbers | Light: plan tiers, complexity multipliers |
| Scheduling need | Crew and calendar, longer jobs | Dispatch, tight turn windows |
| Materials and parts | Full catalog, substitution, EOL logic | Consumables and shop supplies |
| Tax complexity | High: realty vs TPP, fixtures, single-article banding | Service and TPP mix |
| Photo and doc capture | Certification results, as-builts | Before and after, deficiency proof |

Practical implication: build a shared work-order and job spine, then let each division extend it with its own attributes. Do not build a separate app per division. Do not build one rigid app that only fits SPIS.

---

## 5. Guiding principles (architectural guardrails)

These are non-negotiable unless this file changes.

1. **Stripe is the billing source of truth.** Invoices, payments, and tax are computed and settled in Stripe. Nothing bills customers except Stripe.
2. **QuickBooks Online is downstream only.** Data flows Stripe to QBO, one direction, from settled events. QBO never writes back into operational state. This prevents ledger fragmentation.
3. **Tax is decided at the line item, not the invoice.** Each catalog item and labor line carries a tax classification. The ERP passes the correct Stripe tax code per line so Stripe's tax engine handles multi-jurisdiction liability natively. See Section 8.
4. **Event-driven, decoupled services.** Core state changes emit events (AWS EventBridge). Consumers (Lambda) react. Marking a job Complete triggers invoice creation. Nothing is tightly coupled through synchronous chains.
5. **Multi-division isolation with global roll-up.** Postgres row-level security or equivalent tenant scoping. A user sees only their division's data by default; leadership gets cross-division roll-up. Get this right on day one, not as a retrofit.
6. **Documentation is liability protection.** Photos, signatures, certification results, and as-builts are captured, timestamped, and retained. This is a product requirement, not a nice-to-have.
7. **Open and non-proprietary bias.** Prefer portable, standard, replaceable components. Avoid lock-in that we cannot exit.
8. **Secrets never live in code or env files in the repo.** AWS Secrets Manager holds credentials. The app reads them at runtime.

---

## 6. Technology stack

Locked-in unless this file changes. Roles are explicit so the agent does not substitute alternatives.

**Application layer**
- **Next.js + React**: web app and API routes.
- **tRPC**: typed API layer between client and server (house standard).
- **Prisma**: ORM and schema management (house standard).
- **shadcn/ui + Tailwind**: UI components and styling (house standard).
- **Better Auth**: authentication and session management, with organization and multi-tenant support.

**Data and storage**
- **Neon (Postgres)**: primary database. Row-level security for division isolation.
- **Cloudflare R2**: object storage for job-site photos, PDFs, as-builts, certification results.
- **Cloudflare**: DNS, CDN, Turnstile, bot protection.

**Financial**
- **Stripe**: invoicing, payments, subscriptions, tax engine. Source of truth for billing.
- **Stripe product and price architecture**: recurring SMA, monitoring, and maintenance plans modeled as products and prices.
- **QuickBooks Online**: downstream general ledger, fed from settled Stripe data.

**Backend and events**
- **AWS Lambda**: event consumers and background compute.
- **AWS EventBridge**: event bus for decoupled workflows.
- **AWS SES**: transactional email.
- **AWS Secrets Manager**: credential storage.
- **AWS Bedrock**: AI workflows (note summarization, vendor PDF extraction, drafting customer communications).

**Communications and media**
- **Quo (formerly OpenPhone API)**: centralized SMS and voice.
- **AWS SES**: transactional email (status updates, receipts, proposals).
- **Cloudflare R2**: media and document storage.

Deployment on Vercel, source on GitHub, dates and timezones handled with Luxon, consistent with the house standard.

---

## 7. Functional domains

Each domain lists its objective, the commercial platform we model the workflow after, and the verified open-source repo we mine for schema or code. Repo details are in Section 10.

### 7.1 Estimating and quoting
**Objective:** a quoting engine that handles complex assemblies, multi-option bids, and margin tracking, and converts a won quote into an active job with zero re-entry. This extends the existing SPS Portal quote-to-cash foundation (materials catalog with the three-tier hierarchy, part-number requirements, substitution and EOL logic).
**Commercial model:** QuoteWerks and QuoteIQ.
**Open-source reference:** Medusa for product, variant, price, and tax module design. ERPNext for bill-of-quantities and estimate structure.

### 7.2 Field service management and dispatch
**Objective:** real-time dispatching, resource allocation, and a mobile-first technician interface for time logging, material consumption, and signature capture.
**Commercial model:** ServiceTitan and ServiceM8.
**Open-source reference:** Cal.com for the scheduling and availability engine, timezones, and booking model. Plane for the work-order and kanban UI patterns.

### 7.3 Job costing and resource scheduling
**Objective:** track labor, equipment, and material cost against the original estimate in real time, per job and rolled up per division.
**Commercial model:** BuildOps and Rivet.
**Open-source reference:** ERPNext for job-costing DocType schemas and cost-tracking against estimates.

### 7.4 Financials and tax compliance
**Objective:** a pristine automated ledger. Stripe computes tax and settles payment; settled data syncs to QBO. Correct tax code per line item.
**Commercial model:** the Stripe plus QBO integration pattern, done natively.
**Open-source reference:** Bigcapital and Invoice Ninja for double-entry ledger and invoice models. See Section 8 for the tax detail.

### 7.5 Communications and media
**Objective:** centralized SMS and voice through Quo, transactional email through SES, media and documents on R2, ideally threaded per customer or job.
**Commercial model:** the unified inbox pattern.
**Open-source reference:** Novu for multi-channel notification orchestration; Chatwoot for the unified-inbox and threading model if we consolidate SMS and email per contact.

### 7.6 AI-enhanced workflows
**Objective:** use Bedrock to remove routine drudgery, not to make decisions. Summarize technician notes, extract structured data from vendor PDFs and spec sheets, draft customer-facing messages for human review.
**Guardrail:** AI drafts and extracts. Humans approve anything that bills, sends, or commits.

---

## 8. Financial and tax compliance model

This is where most contractor ERPs quietly break. The requirements here are specific.

1. **Line-item tax classification is a first-class attribute.** Every catalog item, labor line, and service maps to a tax treatment. The materials catalog already carries classification for alarm and security components (NVRs, servers, access-control hardware); that classification drives the Stripe tax code sent per line.
2. **Realty vs tangible personal property.** For SPIS, contracts cross realty-improvement and TPP contexts. Tennessee fixture-law doctrine and the single-article tax banding must be reflected in how lines are classified and taxed. The classification lives with the item and the contract context, and the resolved code is what Stripe receives.
3. **Stripe owns the calculation.** We do not compute tax ourselves. We send correct codes and jurisdiction, Stripe computes liability. This keeps multi-jurisdiction correctness out of our code.
4. **QBO sync is one-directional and event-triggered.** On a settled Stripe event (payment, invoice finalized, payout), an EventBridge event fires, a Lambda maps the Stripe objects (line items, fees, clearing account, tax) into QBO entries. Fees and clearing accounts must map cleanly so payouts reconcile.
5. **The sync connector is build-or-buy, not fork.** There is no clean, verified open-source Stripe-to-QBO connector worth forking (the ones in the prior document were fabricated). Options: build the mapper as a Lambda against the official QuickBooks SDK, or buy a commercial connector (Synder, Acodei, or Intuit's own Connector) for that seam and keep operational code clean. Decide deliberately. Mine Bigcapital only for the ledger-mapping concepts, not as a drop-in.

---

## 9. Reference platforms (commercial, what to emulate)

Take the workflow, leave the bloat and the seat pricing.

- **ServiceTitan**: dispatch board, technician mobile flow, job lifecycle. Emulate the dispatch and mobile-first execution. Ignore the enterprise sprawl.
- **ServiceM8**: lightweight job cards, quick quoting, simple field UX. Emulate the simplicity for Cabin Services.
- **QuoteWerks**: assemblies, configurable line items, margin control. Emulate the assembly and quoting engine for SPIS.
- **QuoteIQ**: fast field quoting and clean quote-to-job handoff. Emulate the speed.
- **BuildOps**: job costing against estimates, resource scheduling for commercial trades. Emulate the cost-vs-estimate tracking.
- **Rivet**: labor and material cost tracking, scheduling. Emulate the resource view.

---

## 10. Reference repositories (verified open source)

Every repo below was confirmed to exist and be active. Repos are tiered by how directly they map to our stack.

### Tier 1: on-stack, index and adapt directly (Next.js / TypeScript)

- **vercel/platforms** — the reference for multi-tenant Next.js. Middleware-driven subdomain and division routing. Use this to get Section 5 principle 5 right. Highest-priority reference.
- **nextjs/saas-starter** — official Next.js SaaS starter: Postgres, Stripe subscriptions and webhooks, RBAC, auth. Closest single match to our billing and tenancy needs.
- **boxyhq/saas-starter-kit** — enterprise SaaS starter: Next.js, Prisma, teams and RBAC, audit logs, webhooks, SSO. Strong reference for multi-tenant plus audit trail.
- **vercel/nextjs-subscription-payments** — clean Stripe subscription and webhook plumbing. Mine the webhook-to-state pattern (ignore its Supabase specifics; we are on Neon).
- **calcom/cal.com** — best-in-class scheduling engine in Next.js and TypeScript: availability, bookings, recurring events, timezones. Core reference for dispatch and recurring scheduling. Pairs with our Luxon usage.
- **medusajs/medusa** — modular TypeScript commerce. Reference for product, variant, price, and tax module design and event-driven module patterns. Maps to the materials catalog and Stripe product/price architecture.
- **twentyhq/twenty** — modern open-source CRM in TypeScript. Reference for the customer and contact object model, custom fields, and record views.
- **makeplane/plane** — work and project management in Next.js. Reference for work-order lifecycle, kanban, and cycle/scheduling UI.
- **documenso/documenso** — Next.js and TypeScript e-signature. Reference (or direct component) for signature capture on quotes and job completions.
- **triggerdotdev/trigger.dev** — durable background jobs and workflows in TypeScript. Reference for event-driven workflow patterns even if we stay on EventBridge and Lambda.
- **novuhq/novu** — multi-channel notification infrastructure (email, SMS, push). Reference for orchestrating SES plus Quo/SMS notifications.
- **t3-oss/create-t3-app** — the Next.js, tRPC, Prisma, TypeScript scaffold. Our house stack. Reference for project structure.
- **better-auth/better-auth** — our chosen auth. Reference for organization and multi-tenant plugin patterns.
- **shadcn-ui/ui** — our UI component source.
- **dubinc/dub** — Next.js and Turborepo monorepo done well. Reference for monorepo structure and patterns.
- **formbricks/formbricks** — Next.js forms and surveys. Reference for customer intake and maintenance-request form patterns.

### Tier 2: different stack, mine schema and domain logic only (do not copy code)

- **frappe/erpnext** — the deep ERP reference. Accounting, stock, buying, selling, projects, job costing, bill of quantities. Python and Frappe, so read the DocType schemas and business logic; do not port the code. This is the honest replacement for the fabricated "OpenConstructionERP."
- **frappe/frappe** — the framework under ERPNext, for context on how DocTypes and workflows are modeled.
- **frappe/hrms** — payroll and HR schema reference, relevant to the FLSA-compliant compensation work.
- **frappe/helpdesk** — ticketing model reference for the maintenance-request and deficiency-queue workflows.
- **bigcapitalhq/bigcapital** — open-source double-entry accounting. Reference for the ledger model and Stripe-to-QBO mapping concepts.
- **invoiceninja/invoiceninja** — invoicing, recurring billing, payments (PHP). Reference for invoice, payment, and recurring-plan models.
- **chatwoot/chatwoot** — omnichannel customer messaging (Rails). Reference for the unified-inbox and per-contact threading model if we consolidate Quo SMS and SES email.
- **erxes/erxes** — CRM and engagement (TypeScript). Broader reference for growth and CRM features later.

### Do not use (fabricated in the prior document)

These were recommended by the earlier version of this document and do not exist. Do not search for them, do not cite them:
`Beveren FSM`, `OpenConstructionERP`, `Retail Smart ERP`, `Stripe2QBO`, `Stripe-Intuit-Connector`.

---

## 11. Non-goals and anti-patterns (guardrails for the agent)

- **Do not build three separate apps.** One shared work-order and job spine, division-specific extensions.
- **Do not couple STR Magic to this ERP.** No shared DB, no shared auth. Integration is arms-length only.
- **Do not compute tax in application code.** Classify at the line item, send codes to Stripe, let Stripe compute.
- **Do not write back to QBO into operational state.** One direction only.
- **Do not put secrets in the repo or in committed env files.** Secrets Manager at runtime.
- **Do not chain synchronous calls for cross-domain side effects.** Emit an event, consume it.
- **Do not add a dependency without verifying it exists and is maintained.**
- **Do not use em dashes in any generated copy, docs, or customer-facing text.** House style.
- **Do not let AI actions bill, send, or commit without human approval.**

---

## 12. Suggested build order

Sequenced so each phase de-risks the next. Adjust as needed, but respect the dependency order.

1. **Foundation:** monorepo, Next.js, Prisma, Neon, Better Auth, multi-tenant row-level security, division routing. Model directly on vercel/platforms and boxyhq/saas-starter-kit. Get isolation right before anything else.
2. **Core spine:** customer and contact model, shared work-order and job entities, division extensions. Reference twentyhq/twenty and ERPNext schemas.
3. **Estimating and catalog:** carry over the SPS Portal materials catalog and quoting engine, add multi-option bids and margin, and the quote-to-job conversion. Reference Medusa and QuoteWerks workflow.
4. **Billing and tax:** Stripe products and prices, line-item tax classification, Stripe tax engine wired in. Reference nextjs/saas-starter and vercel/nextjs-subscription-payments.
5. **Dispatch and scheduling:** the scheduling engine and technician mobile flow, signatures, photo capture to R2. Reference Cal.com, Plane, Documenso.
6. **Job costing:** cost capture against estimate, real-time variance, division roll-up. Reference ERPNext and BuildOps workflow.
7. **Financial sync:** EventBridge plus Lambda Stripe-to-QBO connector (build or buy the seam). Reference Bigcapital concepts.
8. **Communications:** Quo SMS and voice, SES email, notification orchestration. Reference Novu, and Chatwoot if consolidating into a unified inbox.
9. **AI workflows:** Bedrock for note summarization, PDF extraction, and drafting, with human approval gates.

---

## 13. Maintenance of this file

When a stack choice, principle, or scope boundary changes, update this file in the same commit as the change. The agent treats this document as authoritative. A stale context file is worse than none, because it produces confident wrong work.
