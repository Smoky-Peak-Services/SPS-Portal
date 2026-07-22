# AGENTS.md — Smoky Peak ERP Portal (SPS Portal 2.0)

This is the engineering handbook for any AI agent (Cursor, Claude, or otherwise) working in this repo. Read it before making structural changes. It is the long-form version of `.cursor/rules/*.mdc` — those files are the fast-recall summary; this file has the reasoning behind each rule.

Two other docs matter: `claude/project-context.md` (why this exists, the two-year vision, reference platforms) and `claude/ARCHITECTURE.md` (the target layered architecture). Both describe where this is _going_. This file describes where it _is right now_ — Phase 1, a solo build, real money and real customer data on the line. When a target doc and this file disagree, this file wins, because it reflects the actual code.

---

## 0. Why the guardrails are strict

This is being built by one person (Ryan) with a real services company's operational and customer data running through it, without the budget of the ERP vendors it's competing with (ServiceTitan, BuildOps, etc.). There is no team to catch a bad migration, no ops staff to notice a leaked customer record, no QA pass before it hits production. The guardrails in this file substitute for that team. Treat them as load-bearing, not as style preferences. When in doubt, do the more conservative thing and say why in the PR/commit, don't guess.

---

## 1. What this is

Smoky Peak Services LLC is a multi-division contractor and short-term-rental service company. This portal is its internal ERP: staff/admin operations, field jobs, scheduling, and (eventually) estimating, billing, and job costing.

**Current state (2026-07-21): dashboard shell + materials catalog + pricing (labor rates + complexity multipliers + recurring fees/SMA + Cabin service plans), seeded per scope from the three master rate workbooks (prompt 14).** A full jobs/tickets/schedule/CRM buildout existed and was deliberately reverted — see §2a. Don't assume Quote/Job/ServiceTicket entities exist until they're rebuilt.

Divisions as currently modeled in `src/config/company.ts` (the single source of truth for company/division/branding — edit only that file for those changes). **`company.divisions` lists operational divisions only** (Integrated Systems, Cabin Services). Smoky Peak Services LLC is the legal entity / brand, not a catalog or pricing scope — do not add it as a `Division` row for materials or labor rates.

- **Integrated Systems** — low-voltage, access control, security, structured cabling. Customer segments Commercial + Residential are **separate datasets**.
- **Cabin Services** — STR property maintenance and quick-turn support. **One scope** (`segments: ["str"]`, scope code `CS_STR`). Prompt 13 briefly aliased a Cabin "Residential" segment onto STR storage (`sharedCatalog`/`storageSegment`); prompt 14 reverted that — there is no `CS_RES`/`CS_COM` and no shared-catalog concept. The storage/customer segment split was later removed entirely: `resolveScope` (`src/features/materials/scope.ts`) just validates the division + segment pair and returns `{ divisionSlug, segment, scopeCode }`.

**Three scopes, nothing shared (prompt 14):** IS Commercial, IS Residential, and Cabin Services each own a complete, independently shaped set of Materials, Attributes, Labor Rates, Complexity Multipliers, and Recurring/Service pricing, seeded from `claude/prompts/samples/{is-commercial,is-residential,cabin-services}-master-rate-sheet.xlsx`. Never treat IS-Commercial's shape (blend SKUs, complexity categories, recurring fee types) as universal.

**Scope pickers (prompt 13):** Always use shared [`ScopeSelector`](src/components/patterns/scope-selector.tsx) (Radix/Base UI `Select` in `src/components/ui/select.tsx`) driven by `company.ts` customer segments — never invent options from seeded rate rows. Show the resolved scope code. Every catalog/labor/recurring query that takes a picker segment calls `resolveScope` (validates the pair, returns segment + scope code) and uses that segment in Prisma `where` — there is no separate storage segment.

**Active scope (prompt 15):** Catalog and Rates share one persistent active-scope context in `src/features/scope/`: resolution order URL `?divisionId=&segment=` (valid pairs only) → `sps_active_scope` cookie (`division-slug:SEGMENT`) → Integrated Systems / COMMERCIAL. RSC pages call `getActiveScope(await searchParams)`; the section layouts (`materials/layout.tsx`, `pricing/layout.tsx`) render the single `ActiveScopeBar` (wrapping `ScopeSelector`) below the tabs — the old page-level `ScopeFilterBar` and `resolvePageScope` are gone; do not add a second switcher. On change the bar writes the cookie client-side and navigates with the scope params, preserving other query keys. Every materials list/count query (`listMaterialCounts`, `listDomains`, `listCategories`, `listItems`, `listAttributes`) requires the scope and filters through `divisionId` + `segment` (`MaterialUnit` stays global). Detail pages redirect to their record's scope params so the switcher stays truthful; create pages/forms default to the active scope and only offer parents within it; empty scoped lists render `EmptyState` (never fall back to another scope's rows). Tests: `npm run test:active-scope`.

Two things described in `claude/project-context.md` are **not yet in code**: the **Trash Valet** division and the **STR Magic** marketplace integration. Don't build against them as if they exist — if a task implies one of them, flag it rather than inventing the missing piece.

---

## 2. Current phase and deliberate non-goals

Per the project `README.md`: this is a login + dashboard shell baseline (Field Ops rebuilt next). The following are explicitly **not built yet, on purpose** — don't add them speculatively even though `claude/project-context.md` describes them as the eventual target:

- No custom Tennessee tax engine, de-minimis logic, or use-tax accruals.
- No Stripe invoice push or payments Lambda.
- No QuickBooks Online sync.

The eventual contract (once this phase lands) is: **Stripe Tax is the single calculator at charge time; the portal only classifies line-item tax codes; QuickBooks stays a downstream AP handoff.** Don't build a second, competing estimate-time tax authority before that classification layer is stable. If a task seems to require billing/tax logic, that's a signal to check with the user before building it — this area has a documented history of scope creep and fabricated dependencies (see `claude/project-context.md` §10, "do not use" list).

---

## 2a. The reset: why Job and Ticket got ripped out

A first pass built `Job` and `Ticket` as two separate top-level entities (a `Ticket` could optionally attach to a `Job`, `Ticket.jobId String?`). That repeated a mistake from a previous, unrelated build: a service ticket got created first and a job attached to it later, when the ticket should have been the job from the start. That two-step "ticket, then attach a job" shape is explicitly what to avoid this time.

On 2026-07-19 the jobs/tickets/schedule/CRM buildout was reverted back to a dashboard-only shell (checkpoint commit `a2caa11`, message "Checkpoint: full field-ops build (jobs/tickets/schedule/CRM) before reset to dashboard-only shell" — the old code is fully recoverable from git history if any of it is worth salvaging, but treat it as reference only, not a base to build on). What survived the reset: auth, sessions, permissions scaffolding, company config, device-surface (mobile/desktop) plumbing, the ops/PII database split and its client libraries, the public lead-ingest endpoint, and the erasure-purge stub.

**The rebuild plan going forward is piece by piece, tested at each step, in this order:** quoting/estimating first, because it drives almost everything else (it's the entry point that should create the operational work item directly, ServiceM8/ServiceTitan-style — one work-order entity, no separate ticket-to-job conversion step).

**Schemas now match that baseline:** ops `prisma/schema.prisma` is auth + org only (no `Job`/`Ticket` residue). PII keeps lead ingest (`Division`, `Lead`, `Activity`, `IngestKey`); CRM `Customer` / `Contact` / `ServiceLocation` were dropped until that phase. Don't resurrect the old two-entity Job/Ticket shape when building the new work-order model unless the user asks for it back.

---

## 3. Stack

- **Runtime**: Node 24 (see `.nvmrc` / `package.json` `engines`) — don't assume Node 20/22 behavior.
- **Next.js 16** App Router, **React 19**, **TypeScript 5**, **Tailwind 3** (+ `tailwindcss-animate`, `prettier-plugin-tailwindcss`).
- **Prisma 7** with the `@prisma/adapter-pg` driver adapter, against **two separate Neon Postgres databases** (see §5 — this is the most important architectural fact in the repo).
- **Better Auth** (`better-auth`) — invite-only email/password, no public sign-up.
- **Zod 4** for schema validation, **react-hook-form** + `@hookform/resolvers` for forms.
- **Luxon** for all date/time handling, localized to `company.timezone`.
- PWA: installable, service worker registers in production only (see `src/components/pwa-register.tsx`, `src/app/manifest.ts`).

---

## 4. Architecture: as-built vs. target

`claude/ARCHITECTURE.md` describes a target layering: `app/` (thin UI) → `server/` (tRPC routers) → `services/` (all business logic) → `lib/` (infra clients), plus `functions/` for Lambda event consumers. **None of `server/`, `services/`, or `functions/` exist in this repo, and there is no tRPC.** Do not create them or introduce tRPC unless the user explicitly asks for that migration — it's a real plan for later, not a mistake to silently "fix" now.

What's actually here, in `src/`, post-reset (§2a) plus materials catalog:

- **`app/(portal)/<area>/`** — pages (App Router, server components). Keep thin: call a feature function, render the result. Areas today: `account`, dashboard (`page.tsx`), `materials` (Catalog section: materials hub + recurring fees UI + import-export), `pricing` (Rates section: labor rates + complexity; `/pricing` redirects to labor-rates), `settings`.
- **`features/<domain>/`** — where the real logic lives, one folder per domain. Today: `materials` (catalog EAV), `pricing` (labor rates + complexity + recurring fees/SMA engines), `accounting` (schema-guard test), `auth`, `cron`, `ingress`. Jobs/tickets/schedule/crm were removed in the reset (§2a) and return later (quoting next). Domain shape:
  - `actions.ts` — `"use server"` Server Actions. Every exported action follows the same order: `requireUser()`/`requireArea(area)` first, then `schema.parse(raw)`, then the Prisma call(s), then `revalidatePath(...)` for every route that shows the changed data.
  - `schemas.ts` — Zod schemas shared between the server action and the client form.
  - `components/` — feature-specific UI.
- **`lib/`** — infra clients and cross-cutting helpers, no business rules:
  - `prisma.ts` — ops DB client.
  - `prisma-pii.ts` — PII DB client (lazy proxy, see §5).
  - `auth.ts` — Better Auth configuration.
  - `session.ts` — `getSession`, `requireUser`, `requireArea` (see §6).
  - `device-surface.ts`, `get-server-surface.ts`, `require-desktop.ts` — mobile vs. desktop routing (see §7).
- **`config/`** — `company.ts` (company/division/feature-flag source of truth) and `permissions.ts` (roles + area access rules).
- **`proxy.ts`** — the edge auth gate. This repo's equivalent of `middleware.ts` (Next 16 naming). Checks only for a session cookie's presence and redirects to `/sign-in`; it does not check roles. Update `PUBLIC_PREFIXES` here when adding a new unauthenticated route (e.g. a new public API endpoint).
- **`components/ui/`** — shadcn primitives (`components.json`, dark tokens in `globals.css`). Prefer these over ad-hoc markup.
- **`components/layout/`** — `AppLogo`, `AppSidebar`, `AppHeader` (portal chrome).
- **`components/patterns/`** — reusable page building blocks: `PageHeader`, `Panel`, `MetricCard`, `DataTableShell`, `SectionTabs`, `StatusBadge`, `EmptyState`. Use these before inventing new page chrome. Portal `<main>` content is one `max-w-7xl` column via `PortalShell`.
- **Theme:** dark-only (`html.dark`). Brand assets in `public/brand/` (mark, logo-dark, PWA icons). Colors: teal/cyan primary — not purple.

**Nav (prompt 12):** Operations has three top-level items — Dashboard, **Catalog** (`/materials`), **Rates** (`/pricing`). Each of Catalog and Rates uses a single horizontal `SectionTabs` strip in the segment `layout.tsx` (no accordions, no third nesting level). Catalog tabs: Materials · Recurring Fees · Catalog I/O · Consumables (`/materials/consumables`). Rates tabs: Labor Rates · Complexity Multipliers. Recurring fees live at `/materials/recurring` visually under Catalog but still gate with `requireArea("pricing")`.

---

## 5. The ops/PII database split (read this before touching any schema)

This is the single most important — and most fragile — architectural decision in the codebase, and it exists for a real legal reason: **customer identity data (name, email, phone, address) must be isolable and erasable independently of operational data**, to make right-to-erasure and data-minimization actually achievable instead of aspirational.

**Two databases, two Prisma schemas:**

|          | Ops DB                                                                                                                                                                                                                                     | PII DB                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Schema   | `prisma/schema.prisma`                                                                                                                                                                                                                     | `prisma/pii/schema.prisma`                               |
| Client   | `src/lib/prisma.ts` → `prisma`                                                                                                                                                                                                             | `src/lib/prisma-pii.ts` → `prismaPii`                    |
| Owns     | `User`, `Session`, `Account`, `Verification`, `Division`, `DivisionMembership`, `Invitation`, materials catalog (`Material*`), consumables (`ConsumableItem`, division-scoped), pricing (`LaborRateConfig`, `LaborPosition`, `ComplexityMultiplier`, `RecurringFeeItem`, `ServicePlanRate`) | `Division` (replicated), `Lead`, `Activity`, `IngestKey` |
| Deferred | Field Ops / work-order models                                                                                                                                                                                                              | CRM `Customer`, `Contact`, `ServiceLocation`             |
| Env vars | `OPS_DATABASE_URL`, `OPS_DIRECT_URL`                                                                                                                                                                                                       | `PII_DATABASE_URL`, `PII_DIRECT_URL`                     |
| Generate | `npm run db:generate`                                                                                                                                                                                                                      | `npm run db:generate:pii`                                |
| Migrate  | `npm run db:migrate`                                                                                                                                                                                                                       | `npm run db:migrate:pii`                                 |

`Division` is replicated into the PII database (same `id`, no FK) so PII rows can reference a division without crossing the boundary; run `npm run sync:divisions-pii` after any ops migration that touches `Division` rows. There is no cross-database Prisma relation.

**The rule: never add a PII-identity column (name, email, phone, street address) to the ops schema.** This is mechanically enforced by `src/features/accounting/ops-pii-schema-guard.test.ts` (`npm run test:schema-guard`), which greps the ops schema for forbidden field names and asserts PII still owns lead ingest (and not deferred CRM models). Run it after touching either schema. When ops rows later need customer display data, batch-fetch from `prismaPii` and merge in memory — don't add a cross-DB relation.

**The PII database is not guaranteed to be configured.** On Vercel, PII access is meant to go through AWS Secrets Manager (`CLIENT_DB_SECRET_ARN`), which per the README is **not wired yet**. Because of this, `isPiiConfigured()` (in `prisma-pii.ts`) must be checked before relying on `prismaPii`, and every caller must degrade gracefully — never let a missing PII config throw and 500 the page. `src/features/ingress/lead-handler.ts` returns a `503` with `reason: "pii_unconfigured"` rather than throwing; match it in new code.

**Public lead intake** (`POST /api/v1/leads`, handled by `handleLeadIngest` in `src/features/ingress/lead-handler.ts`) writes directly into the PII database. It authenticates via a per-division `IngestKey` (hashed, checked against `x-ingest-key`) or a shared server secret (`INGEST_SERVER_SECRET` against `x-ingest-secret`) — treat this endpoint as public-internet-facing and validate accordingly; `proxy.ts` already restricts it to `POST`/`OPTIONS`.

**Right to erasure**: retention windows live in `company.retention` (`customerArchiveYears`, `leadArchiveYears`). `src/features/cron/purge-run.ts` is currently an intentional no-op stub documenting the erasure path (today: closed leads past the cutoff; later: archived customers and related ops rows by string id match). It is not wired to a real cron yet. Don't implement the real deletion logic without checking with the user first — this is exactly the kind of code where a bug deletes real customer data.

---

## 5a. Materials catalog (ops)

Foundation for quoting. Ops-only EAV taxonomy — no customer PII, no tax calculation, no part numbers on items.

Hierarchy: `MaterialDomain` (scoped to `divisionId` + `Segment`) → `MaterialCategory` → `MaterialItem`, with **per-scope** `MaterialAttribute` / options (prompt 14: `@@unique([divisionId, segment, slug])`, no global attributes) assigned to categories via `MaterialAttributeAssignment` — `upsertAssignment` rejects attributes whose scope differs from the category's domain scope. Units live in `MaterialUnit` (seeded: EACH, FT, BOX, ROLL).

Tax classification is metadata only — no Stripe Tax API, no amount calculation, no use-tax accrual in this phase.

- **`StripeTaxCode`**: seeded reference table from `claude/prompts/samples/product_tax_codes.csv` (~673 codes). Category/item `stripeTaxCodeId` are nullable FKs (searchable combobox in admin forms), not free text.
- **`taxProfile`**: `REAL_PROPERTY` | `TPP`. **Derived automatically** from the material Stripe tax code (`deriveTaxProfileFromStripeCode`): `txcd_00000000` (Nontaxable) or unset → `REAL_PROPERTY`; any other code → `TPP`. No manual profile dropdown — assign the category/item material code instead. Category column stays denormalized for list badges and labor-default indexing (synced on write + `npm run backfill:tax-profiles` / seed).
- **`taxReviewed`**: on `MaterialCategory`; walk `/materials/categories?taxReview=1` to confirm codes/profiles deliberately.
- Resolve material code with `resolveItemTaxClassification` / `resolveMaterialStripeTaxCode` (item → category → null; never invent a code for install/service). **Parts sales** (`SaleType: PARTS`) always use `txcd_99999999` (General - Tangible Goods) via `resolveMaterialStripeTaxCode` — no quote UI yet.
- **Labor codes**: `WorkContext` (`INSTALL` | `SERVICE`) + `LaborTaxCodeDefault` + `resolveLaborTaxCode` in `tax.ts` (item labor override → category labor override → default table by **derived** profile → null). Category/item `laborInstallTaxCodeId` / `laborServiceTaxCodeId` are settable via the same searchable comboboxes as material tax codes (list pages show a `labor override` badge when either is set). Nothing consumes `WorkContext` yet (no jobs/quotes). Computer-repair override (`txcd_20080010`) is set manually via category/item labor service FK when reviewing TPP computer categories.
- Same derived `taxProfile` will later inform both customer-facing tax codes and contractor use-tax on realty materials — remittance tracking is out of scope here.

`MaterialCategory.requiresManualPartNumber` is the single control for whether Part Number is required on items (and later quote lines). Manufacturer (`slug: manufacturer`, SELECT) and Part Number (`slug: part_number`, TEXT) are **always assigned** to every category via `ensureCoreAssignmentsForCategory` (create/update category + `npm run ensure:core-assignments` / seed). Manufacturer is always required; Part Number `isRequired` mirrors the checkbox. Do not add `partNumber` / manufacturer columns on `MaterialItem` — values stay EAV when captured.

Admin UI: `/materials` (desktop-only, `requireArea("materials")` — admin + staff). Feature code: `src/features/materials/`. Write-time validation rejects attribute values not assigned to the item's category and rejects missing required attributes.

### Import / export (Excel)

Scoped round-trips live on each list page **and** `/materials/import-export`. Hub page `/materials` has **Export everything** (`GET /api/materials/export-everything`) — export-only multi-sheet audit/backup (Domains + Categories tax + Stripe tax reference + catalog sheets prefixed by scope code + attribute lists + Attribute Assignments). Import stays per-section so one bad edit cannot cascade.

**Item catalog** (`io.ts`, `/materials/items` + hub, `GET /api/materials/export`):

- Workbook: one sheet per domain name; category blocks = title row → header `description | unit | laborUnits | laborUnitNotes | stripeTaxCodeId | laborInstallTaxCodeId | laborServiceTaxCodeId` → items → blank separator. Empty categories are valid. Legacy files without tax columns leave item tax overrides untouched.
- Item tax FKs: blank cell → set null; invalid id → flag, leave DB; do **not** write item `taxProfile` (stays null / inherit).
- Scope code (`IS_COM`, `IS_RES`, `CS_STR` — the only three) from `company.divisions[].code` + customer segment; filename `catalog_{SCOPE}_{YYYY-MM-DD}.xlsx`.
- Matching: `normalizeName` / slugify. Upsert only; **never delete** rows absent from the file.
- **Layout gate:** sheet with no category title→`description` header match is skipped. Zero matched sheets → “doesn't look like a materials catalog export” (blocks commit).
- Flow: `previewMaterialsImport` → `commitMaterialsImport` (**admin / force_delete**, re-parse, `$transaction`).
- Tests: `npm run test:materials-io`.

**Categories tax / linkage** (flat, `/materials/categories`, `GET /api/materials/categories/tax-export`):

- Sheet `Categories`: `domain | category | slug | taxProfile | taxReviewed | stripeTaxCodeId | stripeTaxCodeName | laborInstallTaxCodeId | laborInstallTaxCodeName | laborServiceTaxCodeId | laborServiceTaxCodeName`.
- `slug`, `taxProfile`, `*Name` — export-only. **Import ignores `taxProfile`**; after writing `stripeTaxCodeId`, set `taxProfile = deriveTaxProfileFromStripeCode(...)` (`txcd_00000000`/blank → REAL_PROPERTY; else TPP).
- Match existing `(domain, category)` only — **never create**. Unresolved rows reported and skipped.
- `taxReviewed`: blank → leave + warn; only true/false apply. Tax code FKs: **blank → null**; invalid id → flag, leave DB.
- Re-export before import (stale blanks wipe overrides). Sheet `Stripe Tax Code Reference` lists commonly used codes.
- Tests: `npm run test:materials-category-tax-io`.

**Domains** (flat, `/materials/domains`, `GET /api/materials/domains/export`): `division | segment | name | slug | sortOrder`. Additive create/update; never deletes.

**Attribute assignments** (flat, `/materials/attributes`, `GET /api/materials/attributes/assignments-export`):

- Sheet `Attribute Assignments`: `domain | category | attribute | isRequired | isFilterable | isVariantDefining | defaultOption | sortOrder`.
- **Scoped** (prompt 14): export/import take `divisionId` + `segment`; matching happens within that scope only; filename gains the scope code.
- `attribute` matches slug or name; `defaultOption` by option label (invalid → flag, leave FK). Upsert only; never delete missing assignments.
- Tests: `npm run test:materials-assignment-io`.

### Attribute list import / export (Excel)

Same hub page (`/materials/import-export`, second section) and on `/materials/attributes`; `GET /api/materials/attributes/export`. Pure logic in `attribute-io.ts` / `attribute-io-actions.ts` (not overloaded into catalog `io.ts`).

- **Attributes are per-scope** (prompt 14). The canonical picklists in `src/features/materials/attribute-list-defs.ts` (SELECT: Jacket Color, Cable Jacket Rating, Plastics Color, Hardware Finish, Power Type, Voltage, Amp Rating, POE Class, Box Length, Patch Cable Length, Manufacturer, Attachment Type; plus TEXT `part_number`) are IS lists — `npm run sync:attribute-lists` applies them to the **IS-Commercial scope only** (also run from `prisma/seed.ts`). Sync hard-deletes `vendor`, deactivates legacy `color`, renames `length_feet` → `patch_cable_length`, and deactivates stale options, all within that scope. After sync/seed, `ensureCoreAssignmentsForAllCategories` upserts manufacturer + part_number **per scope** and assigns them on every category (`npm run ensure:core-assignments`).
- Attribute-list export/import is scope-parameterized: the export route requires `divisionId` + `segment`, filenames carry the scope code, and slug matching happens within the selected scope (client uses `ScopeSelector`).
- Workbook: index sheet `Attribute Lists` (`list_key | list_name | filter_mode`) + one sheet per `list_key` (`label | sort_order | tags | rfq_contact | rfq_email`).
- Mapping: `list_key`→`MaterialAttribute.slug`, `list_name`→`name`, `inputType=SELECT`; option `label`→label, `value=slugify(label)` (Power Type / POE Class use stable values in the sync defs), `sort_order`→`sortOrder`.
- **Ignored columns (intentional):** `filter_mode` (filtering is per-assignment `isFilterable`, not on the attribute); `rfq_contact` / `rfq_email` (vendor/RFQ out of catalog scope); **`tags`** (legacy option↔category visibility tags — **no model yet**; do not invent a schema as a side effect of import — decide later if worth a join/tag design).
- Excel upsert by attribute `slug` and option `(attributeId, value)` is **additive only** (never deletes). Use the sync script for full replace/delete semantics.
- Flow: `previewAttributeListsImport` → `commitAttributeListsImport` (**admin only**, re-parse, `$transaction`).
- Fixture: `claude/prompts/samples/attribute-lists-canonical.xlsx` (regenerate with `npm run write:attribute-lists-fixture`). Prior export `attribute-lists-2026-06-24.xlsx` kept for historical reference only.

### Delete

Hard delete (not soft/`isActive`) lives in `src/features/materials/delete-actions.ts`, wired on list pages:

- **Safe delete** (default): refuse with a clear error if children exist (domain→categories, category→items, unit→items). Empty rows delete cleanly.
- **Force delete** (domains/categories, admin only): cascade after typing the entity name to confirm.
- Items: any materials-area user may delete. Domains/categories/units: admin only.

Import upsert and UI delete are separate: missing Excel rows are never removed by import.

### Consumables catalog (prompt 17)

Separate from materials — shop supplies shared by a division (IS Commercial and Residential share one list; Cabin has its own). Model: `ConsumableItem` scoped by **`divisionId` only** (no segment). Feature: `src/features/consumables/`. UI: `/materials/consumables` (Catalog tab; `requireArea("materials")`).

- Sell price = `baseCost × (1 + markupPct)` when not market-rate (`isMarketRate`); never store sell.
- Labor rate/cost are **derived** from the active scope's blended INSTALL rate via `blendedInstallRate` → `distributeQuotedLabor(1h)` — not stored (ignore sheet Labor Rate columns).
- Seed: `scripts/seed-consumables.ts` / `npm run seed:consumables` from `claude/prompts/samples/{is,cabin}-consumables.csv` (~23 IS + ~35 Cabin). Cabin `CON-MR16-DLW-AMZ` sheet sale anomaly is flagged in UI, not auto-corrected.
- **Hard separation:** `MaterialItem.isConsumable` and material pricing columns (`baseCost`/`markupPct`/`wasteFactorPct`) were removed — a consumable is only a consumable by living in this catalog.

### Pricing — labor rates (prompt 09, generalized in 14)

Feature code: `src/features/pricing/`. Admin UI: `/pricing/labor-rates` (desktop-only, `requireArea("pricing")` → `pricing.access`; edits need `pricing.write`).

- **`LaborRateConfig`**: one row per `(divisionId, Segment)` — multipliers `burden`, `standardBillingMultiplier` (renamed from `commercialBillingMultiplier` in prompt 14; 1.89 IS-COM, 1.4 IS-RES/Cabin), `afterHours` 1.45, `holiday` 1.75, plus nullable `discountedMultiplier` (0.90 Cabin only). **Base-driven (prompt 16): base + these multipliers are the source of truth.** Chain (one definition, `recomputeRates` in `recompute.ts`): `cost = base × burden`; `standard = cost × standardBilling`; `afterHours` / `holiday` / `discounted` multiply the (unrounded) standard. Saving a multiplier recomputes and persists every position in the scope; saving a position's base recomputes that row. Engines still read the stored columns — they are a materialized cache regenerated from the formula, never hand-edited.
- **`LaborPosition`**: roles scoped by `(divisionId, Segment)` with SKU unique in scope. Money columns `Decimal(12,2)`; `quotedAllocationPct` `Decimal(5,2)`; nullable `discountedRate` (Cabin rows only; sheet literals keep 3 decimals, e.g. 41.958 — admin saves snap derived columns to cents). **`baseHourlyRate` is the only manually-entered money column** (admin UI: Cost/Std/AH/Hol/Disc are read-only live previews); today it is a manual average of what the role is paid — later it becomes the computed average of employee pay rates (future seam; employee profiles/job costing/payroll are NOT built).
- **`WorkContext`**: INSTALL = blended quote roles; SERVICE = flat-billed roles (IS service techs, Cabin Contractor Coordination `LAB-CBN-CCO-SPC`). Do **not** add a second JOB_QUOTE/SERVICE_TICKET enum.
- **`LaborRateType`**: `STANDARD | AFTER_HOURS | HOLIDAY` — which billable column to use.
- **Blends are per scope:** IS-Com 50/20/15/15 (four INSTALL roles), IS-Res 60/25/15 (`LAB-RES-*-SIS`), Cabin 70/20/10 (`LAB-CBN-*-SPC`). `quotedAllocationSchema` is generalized — it rejects any SERVICE-context position (no hardcoded SKUs) and requires INSTALL allocation to sum to 100.
- **Engines (pure, no Quote/Job entities):**
  - `distributeQuotedLabor` — INSTALL positions only; hours × allocation %.
  - `calculateServiceTicketLabor` — SERVICE positions, flat hours × rate.
  - Cost basis uses `actualCostOfLabor` for every `LaborRateType` (sheet has no AH/holiday cost) — off-hours margin looks inflated until the sheet gains cost multipliers.
- Seed: `scripts/seed-labor-rates.ts` / `db:seed` upserts **all three scopes** from literals in `is-com-rates.ts`, `is-res-rates.ts`, `cabin-rates.ts` (shared shape in `labor-seed-types.ts`; sources: the three `claude/prompts/samples/*-master-rate-sheet.xlsx`).
- Tests: `npm run test:pricing-labor`. No Excel IO.

### Pricing — complexity multipliers (prompt 10, generalized in 14)

- **`ComplexityMultiplier`**: scoped by `(divisionId, Segment)`; `category` is **free text** from each sheet's own vocabulary (Structural, Systems Integration, Amenity, …), not an enum. `multiplierType` `PERCENT | FIXED`; `appliedTo` `TOTAL_LABOR | PROGRAMMING_LABOR | NETWORK_LABOR | BASE_PACKAGE_RATE`; `value` `Decimal(12,4)` — PERCENT values are decimals (0.08 = 8%), FIXED values are dollars.
- **Two engines, strictly separated:**
  - `calculateAdjustedLaborHours({ totalHours, programmingHours?, networkHours? }, multipliers)` — PERCENT rows add hours to their `appliedTo` bucket (buckets fall back to `totalHours` when not itemized); rejects FIXED and `BASE_PACKAGE_RATE` rows. Hours only — never multiplies dollars. Additive, not compounded; no cap.
  - `calculateAdjustedPackageRate(basePackageRate, multipliers)` (`package-rate.ts`, Cabin) — FIXED adds `value` dollars, PERCENT adds `base × value`; rejects labor-bucket rows. Additive; no cap.
- `totalHours` is what later quoting passes into `distributeQuotedLabor`. After Hours Required Installation (+20% hours, IS-Com) may intentionally stack with `LaborRateType.AFTER_HOURS`.
- Admin: `/pricing/complexity` (same `pricing.access` / `pricing.write`); category free text, type/appliedTo/value editable. Seed: `scripts/seed-complexity-multipliers.ts` — all three scopes (IS-Com 10, IS-Res 16, Cabin 20 rows; literals in `is-com-complexity.ts`, `is-res-complexity.ts`, `cabin-complexity.ts`, shared shape `complexity-seed-types.ts`). Cabin rows are all `BASE_PACKAGE_RATE`. Tests: `npm run test:pricing-complexity`.

### Pricing — recurring fees + SMA (prompt 11) and Cabin service plans (prompt 14)

Admin UI: `/materials/recurring` (Catalog section tab; desktop-only). **Still** `requireArea("pricing")` / `pricing.write` — route path ≠ capability area. `/pricing/recurring` redirects here. The page is scope-shaped: IS-Commercial renders `RecurringFeeItem`; **Cabin renders a `ServicePlanRate` table instead**; IS-Residential has no recurring pricing (empty state; its workbook tab is empty).

- **`RecurringFeeItem`**: scoped by `(divisionId, Segment)`, unique SKU in scope. Enums: `BillingCycle`, `RecurringFeeUnit`, `RecurringFeeType` (`SMA_BASE_TIER | SMA_SVM | MONTHLY_SERVICE` in active use; `SMA_BANK_OF_HOURS` stays in the Prisma enum **on purpose** — Bank of Hours returns later as pre-purchased discounted service hours, and dropping a PG enum value costs a painful migration for nothing; it is not seeded and not creatable in admin), `RateValueType` (`CURRENCY | PERCENT`). Money/percent columns `Decimal(12,4)` so SVM percents fit (`0.1560`). Admin supports create/edit/delete per scope so empty sheets (e.g. IS-Residential) can be built from the UI.
- **CSV deviation (locked):** drop duplicate Monthly Monitoring `$18.99` (seed only `$39.99` / `$51.99` / `$46.79`). Bank of Hours (pre-purchase discounted service hours — IS discounted service rate / Cabin field technician) is **deferred**; not in the base catalog.
- **SMA engine** (`sma.ts`): `Total = base tier + SVM` (Bank of Hours not priced yet). `selectSmaBaseTier` bounds TR1 `[500,5000]`, TR2 `(5000,10000]`, … TR5 `(30000,∞)`; exact edge → lower tier; below `$500` → none (Zod rejects). SVM applies to **material value only** (never labor). `SmaPurchaseType { DIRECT, SMA_BUNDLED }` selects **both** the base-tier column and the SVM % together.
- **Monthly engine** (`monthly-service.ts`): `resolveMonthlyServiceRate(item, customerHasActiveSma)` — bundled vs direct only; **no SVM parameter** on the type. Separate code path from SMA.
- Seed: 10 IS-COM rows (`is-com-recurring.ts` / `scripts/seed-recurring-fees.ts`; seed also `deleteMany`s any leftover `SMA_BANK_OF_HOURS` rows). Tests: `npm run test:pricing-recurring` (worked: DIRECT `$12k` → `$3,172.00`; BUNDLED → `$2,854.80`).
- **`ServicePlanRate`** (Cabin only today): scoped by `(divisionId, Segment)`, unique SKU in scope; `planType` `MAINTENANCE | INSPECTION | FULL_SERVICE`, `bedrooms`/`maxBathrooms`, nullable `rate` + `isCustomQuote` (custom-quote rows are rate-less "Quoted"). 18 seeded rows (MP/CIP/FSP × 5 standard tiers + 1 custom) from the Cabin workbook via `cabin-service-plans.ts` / `scripts/seed-service-plans.ts`. Plan rates are the **base package rate** that Cabin `BASE_PACKAGE_RATE` complexity rows adjust via `calculateAdjustedPackageRate`. Rate edits via `updateServicePlanRate` (`pricing.write`; standard rows cannot be made rate-less). Tests: `npm run test:pricing-plans`. Sheet quirk kept verbatim: SKU `FSP-2BE-2BS-STD`.
- Non-goals: no customer/SMA-contract/subscription/invoice; no Stripe; no proration/forfeiture enforcement.

---

## 6. Auth & permissions

Better Auth (`src/lib/auth.ts`) handles sign-in only — invite-only, no public sign-up, **1-hour** session with a **5-minute** `updateAge`. Roles: `admin | power_user | sales | accounting | field_supervisor | field_tech` (ops `Role` enum).

**Session sliding / idle:** Next.js RSCs cannot `Set-Cookie`, so `getSession()` in [`src/lib/session.ts`](src/lib/session.ts) uses `disableRefresh: true`. Cookie extension happens on the client via [`SessionWatchdog`](src/components/session-watchdog.tsx) (`authClient.getSession` on activity, debounced to `updateAge`). Idle timeout is **45 minutes** of no pointer/keyboard/scroll (`NEXT_PUBLIC_SESSION_IDLE_MINUTES`, must stay below Better Auth `expiresIn`). `nextCookies()` is registered last in auth plugins for Server Action / route-handler cookie writes.

**Capabilities (not hard-coded role lists)** gate access. Catalog: `src/config/capabilities.ts`. Persisted matrix: `RoleCapability` + optional `UserCapabilityOverride` (`ALLOW` / `DENY`; deny wins). Seed with `seedCapabilities` (also via `db:seed`). Admins edit `/settings/permissions` and `/settings/users`.

- `requireUser()` resolves `SessionUser.capabilities`.
- `requireArea(area)` / `canAccess(user, area)` check `{area}.access` (settings = permissions or users manage). Areas include `dashboard`, `materials`, `pricing`, `settings`.
- `requireCapability` / `assertCapability` for action-level gates (see `src/features/materials/authz.ts`; pricing write = `pricing.write`).
- Do not authorize with `user.role === "admin"` — use capabilities such as `materials.force_delete`.

Every Server Action must call `requireUser` / `requireArea` / `requireCapability` first. Client nav (`nav.ts` capability filters) is UX only.

`proxy.ts` only checks session cookie presence.

`Invitation` still models invite-only flow. `canInvite(actorRole, targetRole)` governs who can invite whom.

---

## 7. Mobile vs. desktop surfaces

One codebase serves both. `src/lib/device-surface.ts` defines `isDesktopOnlyPath()` and `MOBILE_FALLBACK_ROUTE`. `/materials`, `/pricing`, and `/settings` (and children) are desktop-only; `MOBILE_FALLBACK_ROUTE` is `/`. Server-side, `getServerSurface()` (`get-server-surface.ts`) infers surface from `Sec-CH-UA-Mobile` or the `sps_surface` cookie, defaulting to desktop. Desktop-only server components call `requireDesktopSurface(pathname)` (`require-desktop.ts`) to redirect mobile sessions away. Client-side, `use-device-surface.ts` does the same by viewport width (`MOBILE_MAX_WIDTH = 768`).

Navigation visibility is driven by `src/config/nav.ts` (`capabilities` + `surface` on each item), filtered by `filterNavForCapabilities()`. Register new desktop-only routes in both `device-surface.ts` and `nav.ts`.

---

## 8. Conventions

- New domain logic goes in `src/features/<domain>/`, in the `actions.ts` + `schemas.ts` + `components/` shape (§4). Don't call Prisma directly from a page component.
- Validate every Server Action input with its Zod schema (`schema.parse(raw)`) before touching the database. Never treat a client payload as pre-validated, even from your own form.
- All dates/times go through Luxon, localized to `company.timezone` (currently `America/New_York`).
- After a mutating action, `revalidatePath(...)` every route that displays the changed data — list view, detail view, and any mobile/field-visible surface for that domain. Check sibling actions in the same file for the full revalidation set before assuming you've covered it.
- Formatting: Prettier + `prettier-plugin-tailwindcss` auto-sorts Tailwind class order — don't hand-order classes. Run `npm run format`, `npm run typecheck`, and `npm run lint` before considering a change done.
- No em dashes in generated copy, docs, commit messages, or anything customer-facing. House style, no exceptions.

---

## 9. Environment variables and secrets

Four files, four purposes (see `README.md` for the full table):

- `.env.local` — local secrets, gitignored. Includes `PII_*` and seed vars. Never commit.
- `.env.vercel` — synced to Vercel, gitignored. Must **not** contain raw `PII_DATABASE_URL`, `STRIPE_SECRET_KEY`, or Upstash credentials yet.
- `.env.vercel.example` — key-name template, safe to commit.
- `.env.example` — documented key names, safe to commit.

Key naming: `OPS_DATABASE_URL`/`OPS_DIRECT_URL` (ops DB), `PII_DATABASE_URL`/`PII_DIRECT_URL` (PII DB, local-only until `CLIENT_DB_SECRET_ARN` is wired), `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, `INGEST_SERVER_SECRET` (optional shared secret for the lead-ingest endpoint), `SEED_ADMIN_*` (local seed only). Never invent a new env var name without checking `.env.example` first — the naming convention (`OPS_` / `PII_` prefix) is how the two-database split stays legible in config.

Secrets never live in code or get committed in an env file. Production secrets are meant to move to AWS Secrets Manager as the PII wiring completes — don't work around that by hardcoding a fallback.

---

## 10. Commands

```bash
npm run dev                 # local dev server
npm run build                # prisma generate (both schemas) + next build
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint
npm run format                # prettier --write .
npm run test:schema-guard    # ops/PII boundary guard — run after touching either schema

npm run db:generate          # prisma generate, ops schema
npm run db:generate:pii      # prisma generate, pii schema
npm run db:migrate           # prisma migrate dev, ops
npm run db:migrate:pii       # prisma migrate deploy, pii (also runs sync:divisions-pii)
npm run db:push / db:push:pii
npm run db:seed
npm run sync:divisions-pii   # re-sync Division rows ops -> pii after an ops migration
```

---

## 11. Guardrails, consolidated

- Stripe will be the billing source of truth when billing is built; QuickBooks will be downstream-only, one direction, event-triggered. Not built yet — see §2.
- Never compute tax in application code, now or later — classify line items, let Stripe's tax engine calculate.
- STR Magic is a separate company and codebase. Never share a database, auth boundary, or secrets with it, if/when that integration is built.
- Never add a PII-identity column to the ops schema (§5). Run `npm run test:schema-guard` after any schema change.
- Every Server Action starts with `requireUser()`/`requireArea()` (§6).
- No secrets in code or committed env files (§9).
- No em dashes in generated copy, docs, or customer-facing text.
- AI-driven features (if/when added) draft and extract only — nothing bills, sends, or commits without human approval.
- Don't rebuild Job and Ticket as two separate top-level entities with a ticket-to-job attach step (§2a). The target shape is one work-order entity, created directly by quoting/estimating.
- When `claude/ARCHITECTURE.md` or `claude/project-context.md` describes something that isn't in the code yet, treat it as the plan, not the present — build against what's actually here, and say so if a request assumes the target state already exists.

---

## 12. Where to look for more

- `claude/project-context.md` — full scope, stack rationale, reference platforms/repos, build order.
- `claude/ARCHITECTURE.md` — target layered architecture and worked request traces.
- `claude/prompts/` — scoped build prompts for each rebuild phase, in order (`01-materials-catalog.md`, `02-materials-import-export.md`, `03-materials-import-fix-and-delete.md`, `04-materials-attribute-list-import.md`, `05-materials-tax-code-linkage.md`, `06-materials-labor-tax-override-ui.md`, `07-chrome-brand-color-separation.md`, `08-materials-io-tax-linkage-bulk-edit.md`, `09-labor-rates-and-engines.md`, `10-complexity-multipliers.md`, `11-recurring-fees-and-sma.md`, `12-nav-consolidation-and-ui-consistency.md`, `13-scope-model-and-shared-selector.md`, `14-per-scope-pricing-model-correction.md`, `15-catalog-scope-switcher.md`, `16-base-driven-labor-rates.md`, `17-consumables-catalog.md`). Prompts 09-11 begin the pricing-catalog phase (Integrated Systems Commercial first): labor rates + quoted/service engines, complexity multipliers (hours-only), recurring fees + SMA. Prompt 12 consolidates the nav into two tabbed sections (Catalog = Materials/Recurring Fees/Catalog I/O + reserved Consumables; Rates = Labor Rates/Complexity) and normalizes page/table widths. Prompt 13 adds a config-driven `ScopeSelector` used everywhere and accessible (WCAG-AA-contrast) Radix Select dropdowns. **Prompt 14 is a correction and supersedes the IS-Commercial-only assumptions in 09–13: the three scopes (IS Commercial, IS Residential, Cabin Services — Cabin single/undivided, NOT the STR/RESI split 13 proposed) are structurally different and each owns its own Materials, Labor Rates, Complexity Multipliers, Attributes, and Recurring/Service pricing, seeded from the three `*-master-rate-sheet.xlsx` fixtures.** Prompt 15 (implemented) adds the active-scope catalog switcher: a persistent `ActiveScopeBar` (cookie + URL, `src/features/scope/`) at the top of the Catalog and Rates sections, and scope-filters every materials list/count query, so you switch which of the three catalogs you're viewing and everything below reflects it (price-book/regional-catalogue pattern). Prompt 16 corrects labor-rate authority: Base rate + scope multipliers are the source of truth and Cost/Standard/After-hours/Holiday/Discounted derive from Base via the multiplier chain (cost=base×burden, standard=cost×markup, AH & holiday multiply the standard rate); only Base is editable per position, multipliers drive/recompute all rates, one shared compute function. Base rate is a manual placeholder now, later an average from employee profiles feeding job costing/payroll (not built yet). Prompt 17 adds the Consumables catalog (`ConsumableItem`): scoped by division ONLY (one shared dataset per Integrated Systems and per Cabin Services — no segment split), sell price derived from base × markup, and the labor rate derived from the division's blended install rate (never stored), with materials-style add/edit/delete. Read the next-numbered prompt before starting the next phase of the rebuild. `claude/prompts/samples/` holds real fixture files (prior-build exports, plus the real Stripe `product_tax_codes.csv`) referenced by these prompts — use them as actual test data, not just as descriptions.
- `README.md` — quick-start, env file table, current portal routes.
- `.cursor/rules/*.mdc` — the same guardrails as short, glob-scoped Cursor rules.
