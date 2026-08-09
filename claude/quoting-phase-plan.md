# Quoting / Work Order phase — plan

Written 2026-08-08, after a full repo review. This is the design brief for the next major phase (AGENTS.md §2a: *"quoting/estimating first, because it drives almost everything else"*). It is **not** a Cursor prompt — two decisions need Ryan's answer first (§5). Once those are settled, this becomes prompts 27–31.

Prerequisite fixes live in `claude/prompts/22`–`26`. Prompt 25 in particular must land before any quote row exists.

---

## 1. The problem this design has to solve

### 1a. The reprice trap

There is **no versioning, effective-dating, audit table, or price history anywhere** in the repo. Every catalog and rate row carries only `createdAt` / `updatedAt` and mutates in place.

Worse, prompt 16 made rate mutation *cascading and scope-wide by design*, and that shipped — `src/features/pricing/actions.ts:108-146` (`updateLaborRateConfig`) recomputes `actualCostOfLabor`, `standardBillingRate`, `afterHoursRate`, `holidayRate` and `discountedRate` on **every position in the scope** from one multiplier edit, retaining nothing.

So if quoting is built to store `laborPositionId` + hours, the day Ryan tunes burden from 1.85 to 1.40 — which prompt 16 explicitly anticipates him doing — **every quote ever issued silently reprices.** Same for `ComplexityMultiplier.value`, `ServicePlanRate.rate`, `RecurringFeeItem.directPurchaseRate`, `ConsumableItem.baseCost`.

It's worse for values with no row at all: `EQUIPMENT_MARKUP = 1.15` is a code constant (`src/features/equipment/schemas.ts:7`), consumable sell price is never stored (`consumables/schemas.ts:86`), and consumable labor rate is assembled at render time from N `LaborPosition` rows that all mutate together.

**Answer: snapshot on the quote line, don't version the catalog.** Every line stores everything needed to reprint it forever — description, unit, quantity, unit cost, markup, waste, unit price, extended price, extended cost, tax code as a plain string. `sourceId` points at the catalog row but is deliberately **not** a foreign key, so a force-deleted category can't orphan or `SetNull` an accepted quote. This is far cheaper than effective-dating six catalog models, and it is the only approach that survives the code-constant case.

### 1b. Materials have no price at all

Migration `20260722030000_consumables_catalog/migration.sql:794-797` dropped `baseCost`, `markupPct`, `wasteFactorPct` and `isConsumable` from `material_item`. `MaterialItem` now holds name, `laborUnits`, supplier, notes, tax FKs and EAV values — **no cost column anywhere**, and no `MaterialPrice` / `VendorPrice` model.

Prompt 17 justified this as *"materials store no pricing; material pricing is obtained at quote time"* — but nothing implements or even sketches "obtained at quote time." No vendor integration, no price sheet, no manual-entry seam.

Everything else can price a line: `ConsumableItem` has `baseCost` + `markupPct`, `EquipmentItem` takes cost at use time, `LaborPosition` has full rate columns, `ServicePlanRate` has `rate`, `RecurringFeeItem` has direct/bundled. **Materials are the only hole, and they're the largest line category.** This is the single hard blocker on quoting.

### 1c. The two-database split

The quote references a PII `Customer` and ops catalog items, with no cross-DB FKs and no distributed transaction.

**The quote/work order belongs in ops** — it's money, catalog, rates, scheduling and job costing, and it must survive customer erasure as an anonymized financial record.

Four rules make it work:

1. **Ops stores opaque cuids, never identity strings.** `customerId`, `serviceLocationId`, `primaryContactId`, `leadId` — plain `String`, indexed, no FK. AGENTS.md §5 already blesses this ("batch-fetch from `prismaPii` and merge in memory"), and `Customer.createdById` already does it in reverse.
2. **The identity-bearing artifact lives in PII.** A signed estimate legally needs a durable "bill to: name, address" — and that string is exactly what must be erasable. A PII `WorkOrderDocument` (opaque `workOrderId`, rendered `billToBlock` / `siteBlock` / `renderedHtml`) gives both: erasure deletes the identifying artifact, ops keeps the anonymous financial record. **Do not put bill-to text in ops** — the schema guard would not catch a generically-named field, and slipping it past defeats the architecture.
3. **Ops is the writer of record; PII writes are best-effort and idempotent.** Sequence: verify the PII customer exists → commit the ops transaction → write the PII `Activity` / document, keyed idempotently on `Activity.externalId` (e.g. `wo:<workOrderId>:sent`). A crash between the two leaves a valid work order and a missing activity — recoverable. The reverse would not be.
4. **Quoting hard-fails when PII is unconfigured.** The CRM list pages return `[]` (`crm/queries.ts:14,23`); quoting cannot. Creating a work order against a customer you can't verify is worse than an error. Match the `lead-handler.ts` shape — explicit refusal with a reason.

At write time, assert `Customer.divisionId` (PII) matches `WorkOrder.divisionId` (ops), and run the chosen segment through `resolveScope(divisionSlug, segment)`. **Store both `divisionId` and `segment` on the work order** — which of the three catalogs a quote drew from is not recoverable from the customer alone, because `Customer.type` is a CRM label, explicitly not a catalog scope.

---

## 2. Proposed model (ops)

Name it **`WorkOrder`** — one entity, no ticket-to-job conversion (AGENTS.md §2a, §11). `ops-pii-schema-guard.test.ts:75-77` asserts `model Job {` / `model Ticket {` / `model TimeEntry {` stay absent; add positive assertions for the new models in the same pass.

```prisma
enum WorkOrderStatus {
  DRAFT ESTIMATE_SENT ACCEPTED SCHEDULED IN_PROGRESS
  COMPLETED INVOICED CLOSED DECLINED CANCELLED
}

enum EstimateLineSource {
  MATERIAL CONSUMABLE EQUIPMENT LABOR RECURRING_FEE SERVICE_PLAN CUSTOM
}

model WorkOrder {
  id                String @id @default(cuid())
  number            String @unique          // human-readable, sequence-backed — cuid is not quotable
  divisionId        String
  division          Division @relation(fields: [divisionId], references: [id])
  segment           Segment
  workType          WorkContext              // reuse INSTALL | SERVICE — do NOT add a fourth enum
  status            WorkOrderStatus @default(DRAFT)
  /// PII Customer.id — no FK across DBs (AGENTS.md §5)
  customerId        String
  serviceLocationId String?
  primaryContactId  String?
  leadId            String?
  title             String
  createdById       String
  acceptedAt        DateTime?
  closedAt          DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  estimates         WorkOrderEstimate[]

  @@index([customerId])                    // the purge job scans this
  @@index([divisionId, segment, status])
  @@index([status, updatedAt])
  @@index([leadId])
}

model WorkOrderEstimate {
  id            String @id @default(cuid())
  workOrderId   String
  workOrder     WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  revision      Int
  isCurrent     Boolean @default(true)
  /// Frozen when status leaves DRAFT. Every rate below is a snapshot as of this instant.
  pricedAt      DateTime?
  laborRateType LaborRateType            // needs DISCOUNTED added — see prompt 25 §3
  baseHours     Decimal @db.Decimal(12,4)
  adjustedHours Decimal @db.Decimal(12,4)
  materialTotal Decimal @db.Decimal(12,2)
  laborTotal    Decimal @db.Decimal(12,2)
  otherTotal    Decimal @db.Decimal(12,2)
  subtotal      Decimal @db.Decimal(12,2)
  costBasis     Decimal @db.Decimal(12,2)
  createdAt     DateTime @default(now())

  lines        EstimateLine[]
  laborRoles   EstimateLaborAllocation[]
  complexities EstimateComplexitySelection[]

  @@unique([workOrderId, revision])
  @@index([workOrderId, isCurrent])
}

model EstimateLine {
  id              String @id @default(cuid())
  estimateId      String
  estimate        WorkOrderEstimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  sortOrder       Int @default(0)
  source          EstimateLineSource
  /// Catalog row id at time of pricing. NOT a foreign key — the catalog may change
  /// or the row may be force-deleted; the snapshot below is authoritative.
  sourceId        String?
  sourceSku       String?
  // ---- snapshot: everything needed to reprint this line forever ----
  description     String
  unitCode        String?
  quantity        Decimal  @db.Decimal(12,4)
  unitCost        Decimal? @db.Decimal(14,4)
  markupPct       Decimal? @db.Decimal(6,4)   // includes the EQUIPMENT_MARKUP code constant
  wasteFactorPct  Decimal? @db.Decimal(6,4)
  unitPrice       Decimal  @db.Decimal(14,4)
  extendedPrice   Decimal  @db.Decimal(12,2)
  extendedCost    Decimal  @db.Decimal(12,2)
  laborUnits      Decimal? @db.Decimal(12,4)
  stripeTaxCodeId String?                     // plain string, NOT an FK — sidesteps the SetNull trap
  taxProfile      MaterialTaxProfile?

  @@index([estimateId, sortOrder])
  @@index([sourceId])
}

model EstimateLaborAllocation {
  id            String @id @default(cuid())
  estimateId    String
  estimate      WorkOrderEstimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  positionSku   String                        // snapshot, not FK
  positionTitle String
  allocationPct Decimal @db.Decimal(5,2)
  hours         Decimal @db.Decimal(12,4)
  rateUsed      Decimal @db.Decimal(12,2)     // frozen — LaborPosition WILL be overwritten
  costRate      Decimal @db.Decimal(12,2)
  billable      Decimal @db.Decimal(12,2)
  cost          Decimal @db.Decimal(12,2)

  @@unique([estimateId, positionSku])
}

model EstimateComplexitySelection {
  id             String @id @default(cuid())
  estimateId     String
  estimate       WorkOrderEstimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  slug           String
  name           String
  multiplierType ComplexityMultiplierType
  appliedTo      ComplexityAppliedTo
  value          Decimal  @db.Decimal(12,4)   // frozen
  addedHours     Decimal? @db.Decimal(12,4)
  addedAmount    Decimal? @db.Decimal(12,2)

  @@unique([estimateId, slug])
}
```

**Revisions, not mutation.** Editing an `ESTIMATE_SENT` estimate creates revision N+1; the old one stays byte-identical. That is what makes "what did we quote in March" answerable.

**One entity, two behaviors.** `workType: WorkContext` reuses the existing enum. INSTALL routes through `calculateAdjustedLaborHours` → `distributeQuotedLabor`; SERVICE routes through `calculateServiceTicketLabor`. There is no conversion step because there is only one row.

---

## 3. Build sequence — five increments, each independently testable

**Step 1 — Material cost, as a bulk sheet round-trip, no new UI.**
Requires decision 5a. Add `unitCost Decimal(14,4)?`, `markupPct Decimal(6,4)?`, `wasteFactorPct Decimal(6,4)?` to `MaterialItem`. Extend the existing category-block workbook in `src/features/materials/io.ts` with three columns, using the same legacy-tolerant rule already documented for tax columns ("legacy files without tax columns leave item tax overrides untouched"). Extend `export-everything`. Bulk-sheet-first by construction — no per-row admin for 5,000 items.
*Test:* extend `npm run test:materials-io`; round-trip `catalog_IS_COM_*.xlsx`, assert no non-price column changes and legacy files leave prices untouched.

**Step 2 — Pricing resolver layer: pure functions, still no entity.**
New `src/features/quoting/` with `priceMaterialLine`, `priceConsumableLine`, `priceEquipmentLine`, `priceLaborLine` (wrapping the existing engines), `priceServicePlanLine` — each returning a fully-populated `LineSnapshot` matching `EstimateLine`'s columns exactly. Convert engine internals to `Prisma.Decimal` (prompt 25 §6). This mirrors the pattern that worked three times already (prompts 09/10/11: *"pure functions with nothing attached"*).
*Test:* new `npm run test:quoting` reproducing the existing worked examples end to end — the prompt 09 `$8,898.80` blend, the prompt 11 `$3,172.00` SMA, the prompt 10 `18.20h` additive case — but arriving through the line-snapshot API.

**Step 3 — Ops schema + the anti-reprice regression test.**
Land the five models with the indexes and uniques above. Migration + schema-guard update. Still no UI — drive it from a test.
*The test that matters:* build an estimate against seeded IS-Commercial and assert totals; then call `updateLaborRateConfig` to change `burdenMultiplier`; re-read the stored estimate and assert **every number is unchanged.** That single test is the permanent guard against §1a. Mirror it for `ComplexityMultiplier.value` and `ConsumableItem.baseCost`.

**Step 4 — Quote builder UI.**
`/work-orders` list + `/work-orders/[id]`, and real content for the existing `src/app/(portal)/clients/[id]/estimates/page.tsx` placeholder. Create from a `Customer` or promote directly from a `Lead`. Scope locks from the customer's division at creation and drives every catalog picker through the existing `ScopeSelector` / `getActiveScope` primitives — prompt 15 built those to be *"the one reusable primitive"* for exactly this. Register `workorders.access` / `.write` / `.price` / `.accept` in `capabilities.ts`, `AREA_ACCESS_CAPABILITY`, `nav.ts`, and `device-surface.ts` (§7 requires both of the last two). ACCEPT gates on `isBillingComplete` (`src/features/crm/billing.ts:23`, which prompt 20 built for exactly this) and freezes the revision.

**Step 5 — PII document snapshot + lead-status derivation.**
PII `WorkOrderDocument`. Derive `Lead.status` `ESTIMATE_SENT` / `APPROVED` / `WON` from work-order transitions instead of manual selection, writing the `Activity` idempotently via `externalId`. Extend `purge-run.ts` for estimate retention — after prompt 25 §1 fixes the `Activity.leadId` cascade.

---

## 4. Other prerequisite gaps

Beyond prompt 25's list:

- **No `quotes.*` / `workorders.*` capability** exists in `src/config/capabilities.ts`, `permissions.ts:30-36`, `nav.ts`, or `device-surface.ts:15`. Note `ROLE_LABELS.sales` is already `"Sales / Estimating"` — the role exists, its capabilities don't.
- **`LeadStatus` conflates pipeline stage with terminal outcome**, and hardcodes the split in application code: `ACTIVE_LEAD_STATUSES` / `ARCHIVED_LEAD_STATUSES` are literal arrays at `crm/queries.ts:94-101`. Worse, `ESTIMATE_SENT` and `APPROVED` **presuppose a quote entity that doesn't exist** — they're human-set today, so the moment quotes are real there are two sources of truth for "was an estimate sent" that will drift within a week. Derive from work-order status; don't let both be settable.
- **Three overlapping "kind of work" axes already exist:** `WorkContext { INSTALL, SERVICE }` (ops enum), `LaborRateType` (ops enum), and `SaleType = "INSTALL_JOB" | "SERVICE_JOB" | "PARTS"` — a TypeScript-only union at `src/features/materials/tax.ts:21` used by `resolveMaterialStripeTaxCode`. §5a is emphatic about not adding a fourth, but `SaleType` is already a de-facto third axis living outside the database. Reconcile before the work order picks its discriminator.
- **Deferred but will be missed fast:** the Service Rates tab (standard/emergency/remote/travel/mileage/lift/minimums) and Common Packages (`PKG-*`) — both deferred in prompt 14 §Part 5, both already sitting in `claude/prompts/samples/is-commercial-master-rate-sheet.xlsx`. A SERVICE work order can't be priced without minimums, travel and mileage; `calculateServiceTicketLabor` handles only `hoursLogged × rate`.
- **Complexity selections aren't recordable today** — `calculateAdjustedLaborHours` takes multipliers as a function argument and nothing persists which ones an estimator picked. `ServiceLocation.complexitySelections String[]` (PII) is the closest thing, and it's a bare unvalidated string array in the wrong database.
- **No discount, adjustment, deposit, terms, expiry, or acceptance-signature concept** anywhere. Decide how much of that belongs in v1.
- **`ServicePlanRate.isCustomQuote` rows have `rate = null`** — a line sourced from one needs a manual price override field.

---

## 5. Two decisions needed before Step 1

**5a. Where does material cost come from?**

- *Option A — three columns on `MaterialItem`*, populated by the existing Excel round-trip. Simple, one price per item per scope, ships in one increment. Partially reverses migration `20260722030000`, so it needs an explicit OK (and `ops-pii-schema-guard.test.ts:64` asserts `isConsumable` stays gone — that stays gone either way).
- *Option B — a `MaterialPrice` model* keyed `(materialItemId, supplierId, effectiveFrom)`. Supports multiple vendors and real price history, but it's a bigger build and more admin surface.

Recommendation: **A now, B later if multi-vendor becomes real.** The line-snapshot design in Step 3 means a later move to B cannot retroactively break existing quotes.

**5b. Is `MaterialCategory.requiresManualPartNumber` a quote-time gate?**
AGENTS.md §5a calls it *"the single control for whether Part Number is required on items (and later quote lines)."* If yes, `EstimateLine` needs a `partNumber String?` and the line validator must read the category's flag. Worth settling now rather than discovering it at Step 4.
