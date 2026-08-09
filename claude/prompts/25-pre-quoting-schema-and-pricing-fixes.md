# Prompt 25 — Pre-quoting fixes: schema integrity, pricing gaps, decimal math

**Do this before any `Quote` / `WorkOrder` model exists.** Each item is a defect that becomes far more expensive to fix once quote rows reference this data. Nothing here adds a new feature or a new entity.

Read `AGENTS.md` §5, §5a and `claude/prompts/09`, `10`, `11`, `14`, `16` first.

---

## 1. HIGH — `Activity.leadId onDelete: Cascade` will delete a live customer's history

`prisma/pii/schema.prisma:255`

```prisma
lead  Lead? @relation(fields: [leadId], references: [id], onDelete: Cascade)
```

An `Activity` can carry **both** `leadId` and `customerId`. After promotion the lead's call/SMS/note history *is* the customer's history — it renders in `getCustomerProfile` (`src/features/crm/queries.ts:71-79`).

Now read `src/features/cron/purge-run.ts:5-6`: *"Find closed PII leads older than `company.retention.leadArchiveYears` and delete (cascades lead-scoped activities)."* `leadArchiveYears` is **3**, `customerArchiveYears` is **5**. So at year 3, purging a **won** lead cascade-deletes the activity trail of an active, still-retained customer.

`contactId` and `serviceLocationId` already correctly use `SetNull` — `leadId` and `customerId` are the outliers.

**Fix:** change `Activity.leadId` to `onDelete: SetNull`, PII migration included. `leadId` is already nullable so no data change is needed. Leave `customerId` on Cascade (deleting a customer *should* take their activities), but add a comment explaining why the two differ.

The purge job stays a no-op stub — **do not implement real deletion logic** (AGENTS.md §5 requires checking with Ryan first). Just fix the cascade so the stub is safe when it is eventually wired.

---

## 2. HIGH — six `StripeTaxCode` FKs are `SetNull`; one reseed silently wipes tax classification

`prisma/migrations/20260720080000_stripe_tax_codes/migration.sql:436-442` — all six of `material_category.stripeTaxCodeId / laborInstallTaxCodeId / laborServiceTaxCodeId` and the three `material_item` equivalents are `ON DELETE SET NULL`.

`StripeTaxCode` is seeded reference data (~673 rows from `product_tax_codes.csv`). Any reseed that does `deleteMany` before insert, or any Stripe code retirement, nulls the classification on all 115 IS-Commercial categories. And because `MaterialCategory.taxReviewed` is an independent boolean, those rows stay flagged **reviewed** while now being unclassified — so the `/materials/categories?taxReview=1` walk documented in AGENTS.md §5a will never surface them.

`LaborTaxCodeDefault.stripeTaxCodeId` is already correctly `RESTRICT`.

**Fix:** change all six to `onDelete: Restrict`, ops migration included. Then check `scripts/seed-stripe-tax-codes.ts` — if it does a `deleteMany` before insert, convert it to an upsert-by-id so a reseed cannot fail on the new constraint.

---

## 3. HIGH — `LaborRateType` has no `DISCOUNTED`, so Cabin's discounted rate is unquotable

`LaborRateConfig.discountedMultiplier` (0.90 for Cabin) and `LaborPosition.discountedRate` exist, are seeded, are recomputed by `recomputeRates` (`src/features/pricing/recompute.ts:53-56`), and are displayed in admin. But:

- `enum LaborRateType { STANDARD, AFTER_HOURS, HOLIDAY }` (`prisma/schema.prisma:51`) has no fourth member.
- `RateColumns` (`src/features/pricing/rate-for.ts:11-16`) does not include `discountedRate`.
- So `rateFor()` cannot return it and `distributeQuotedLabor` cannot select it.

A whole persisted, seeded, admin-editable rate column has no path into any engine.

**Fix:** add `DISCOUNTED` to the enum (ops migration) and `discountedRate` to `RateColumns` / `rateFor()`. Add a test case to `npm run test:labor` covering the discounted path.

---

## 4. HIGH — the 100% blend invariant is validated at read time, not write time

`quotedAllocationSchema` (`src/features/pricing/schemas.ts:37-56`) enforces sum-to-100, but it runs inside `distributeQuotedLaborInputSchema` — i.e. when the **engine is called**. The admin write path `updateLaborPosition` (`src/features/pricing/actions.ts:148-186`) validates only `z.coerce.number().min(0).max(100)` per row (`admin-schemas.ts:34`) with no cross-row check.

An admin editing three Cabin positions one at a time lands the scope at 90%, saves cleanly, and the failure surfaces later as a thrown Zod error the first time someone prices a quote.

**Fix:** inside `updateLaborPosition`, recompute the sum across the scope's INSTALL positions within the same transaction and reject the save if it would leave the scope off 100 (allow a small epsilon for the `Decimal(5,2)` scale). Show the running total in the admin UI so the admin can see where they are mid-edit.

---

## 5. MEDIUM — `updateLaborRateConfig` writes the config outside the recompute transaction

`src/features/pricing/actions.ts:114-146`: `prisma.laborRateConfig.update(...)` commits first, then a **separate** `$transaction` recomputes every position. If the second call fails, the multipliers say one thing and every stored rate says another — and since AGENTS.md declares those columns a cache regenerated from the formula, nothing will ever detect the drift.

**Fix:** wrap both in one `prisma.$transaction`.

---

## 6. HIGH — the pricing engines compute money in IEEE-754 floats

Storage is correct — I checked every column, there is no float money anywhere and no Int-cents. But `src/features/pricing/blended-rate.ts:22-31` converts the whole rate card out of Decimal:

```ts
return positions.map((p) => ({
  quotedAllocationPct: Number(p.quotedAllocationPct),
  standardBillingRate: Number(p.standardBillingRate),
  ...
```

and every engine (`quoted-labor.ts`, `service-labor.ts`, `adjusted-hours.ts`, `package-rate.ts`, `sma.ts`, `monthly-service.ts`) is typed `number`. The mitigation is:

```ts
// src/features/pricing/rate-for.ts:7
export function roundMoney(n: number): number {
  return Math.round(Number((n * 100).toPrecision(12))) / 100;
}
```

That `toPrecision(12)` hack exists precisely because binary float was producing wrong half-cent rounding. It holds for today's two-step chains. It will not hold for a quote total that sums dozens of already-rounded lines, applies percent complexity, then applies SVM to the material subtotal. `distributeQuotedLabor` also rounds **per role and again on each accumulation** (`quoted-labor.ts:68-69`), compounding rounding rather than summing exact values and rounding once.

**Fix:** convert the engine internals to `Prisma.Decimal`. Keep `number` at the UI boundary only. Round **once**, at the point a value is persisted or displayed — not at every intermediate step. All existing pricing tests must still pass unchanged; if a test's expected value shifts by a cent, stop and flag it rather than editing the expectation.

**Also decide now, before quote lines exist:** money scale is currently mixed — `Decimal(12,2)` on `LaborPosition` / `ServicePlanRate`, `Decimal(12,4)` on `RecurringFeeItem` / `ConsumableItem.baseCost`. A quote line will have to sum both. Adopt one convention and write it into `AGENTS.md` §5a: **`Decimal(14,4)` for line-level unit and extended amounts, `Decimal(12,2)` for document-level totals.**

---

## 7. MEDIUM — missing unique constraints that quoting will depend on

- **`ServicePlanRate` has no unique per bedroom tier** — only `@@unique([divisionId, segment, sku])`. Nothing stops two `MAINTENANCE` rows both claiming `bedrooms = 3`, so "Cabin, maintenance plan, 3BR → rate" has no deterministic answer. Add `@@unique([divisionId, segment, planType, bedrooms])`. If `isCustomQuote` rows break that, make it a partial unique index in raw SQL in the migration.
- **`RecurringFeeItem` allows multiple SVM rows per scope.** `calculateAnnualSmaPrice` (`src/features/pricing/sma.ts:50-55`) takes exactly one `svm` object; two `SMA_SVM` rows in a scope make the caller's choice arbitrary. Add a unique on `(divisionId, segment, feeType)` restricted to `SMA_SVM`, or validate it in the write action.
- **Overlapping `SMA_BASE_TIER` ranges** — nothing prevents `systemValueMin/Max` overlaps, and `selectSmaBaseTier` (`sma-tier.ts:29-42`) resolves them by sort order, first match wins, silently. Add a write-time validation that a new/edited tier does not overlap an existing one in the same scope.
- **`Invitation` has no unique on pending email** — `@@index([email])` only. Multiple live invites per address are possible.

---

## 8. MEDIUM — `(divisionId, segment)` validity is enforced only in application code

`resolveScope` (`src/features/materials/scope.ts:524`) throws on invalid pairs and `active-scope.ts` filters the options, but the database happily accepts `(cabin-services, COMMERCIAL)` on `MaterialDomain`, `LaborPosition`, `ComplexityMultiplier`, `RecurringFeeItem`, `ServicePlanRate` and `MaterialAttribute`. This is exactly the bug class prompt 13 fixed at the UI layer and left unguarded at the data layer. One seed script or raw SQL fix creates a phantom fourth scope with a full catalog behind it — and a quote will stamp `(divisionId, segment)` and inherit the same hole.

**Fix:** add a CHECK constraint (raw SQL in the migration) on each of those tables enforcing the valid pairs, driven by the same list `company.ts` uses. Keep it simple and explicit — a two-row `Scope` table with an FK is cleaner long-term but is a bigger change; propose it to Ryan rather than doing it unasked.

---

## 9. MEDIUM — missing indexes, cross-checked against real queries

| Query | Location | Add |
|---|---|---|
| `listLeads` filters `divisionId` + `status IN`, orders `updatedAt desc` | `crm/queries.ts:115-130` | `Lead @@index([status, updatedAt])` — there is no `updatedAt` index at all today, so every lead list is a full sort |
| `listCustomers` filters `archivedAt` + `divisionId` + `type`, orders `displayName asc` | `crm/queries.ts:26-39` | `Customer @@index([archivedAt, displayName])` |
| `getCustomerProfile` activities `where customerId orderBy createdAt desc take 50` | `crm/queries.ts:71-79` | `Activity @@index([customerId, createdAt])` and `@@index([leadId, createdAt])` — *(prompt 23 also adds these; do it once)* |
| `recentCallLog` filters `occurredAt >= since AND dismissed = false` | `phone/queries.ts:54-58` | `PhoneEvent @@index([dismissed, occurredAt])` |
| Better Auth session lookups and user-cascade deletes | `prisma/schema.prisma:124-155` | `Session @@index([userId])`, `Account @@index([userId])` — Postgres does not auto-index FK columns |
| `LaborTaxCodeDefault.stripeTaxCodeId` | `prisma/schema.prisma:453` | index it |

Ops scoped reads are already fine — `LaborPosition`, `ComplexityMultiplier`, `RecurringFeeItem` and `ServicePlanRate` all have composite indexes covering their `where` clauses. Leave those alone.

One thing to note but **not** act on yet: `listItems` (`materials/actions.ts:223-232`) joins item → category → domain to filter scope. Index-supported at each hop and fine at 102 items, but a quote line-item picker doing this per keystroke over a 5,000-row catalog will want a denormalized `divisionId` / `segment` on `MaterialItem`. Flag it, don't build it.

---

## 10. MEDIUM — public lead ingest has no idempotency key

`src/features/ingress/lead-handler.ts:190` does a bare `prismaPii.lead.create(...)`. No unique constraint, no dedupe window. `Lead` has `@@index([email])` but nothing unique except `id`. A double-clicked form, a Vercel retry, or a CDN replay creates duplicate leads — and each duplicate promotes to a duplicate `Customer`.

**Fix:** add `externalId String? @unique` to `Lead`, mirroring the pattern already proven on `Activity.externalId` and `PhoneEvent.externalId`. Accept an optional `idempotencyKey` in the ingest payload; when present, use `upsert` on it. When absent, fall back to a soft dedupe: reject (as `{ ok: true, duplicate: true }`, not an error) a create where `(divisionId, email, name)` matches a lead created in the last 5 minutes. Update `claude/prompts/19-marketing-lead-form-standard.md` to document the new optional field.

---

## Acceptance

- `npm run test:schema-guard`, `npm run test:labor`, `npm run test:complexity`, `npm run test:recurring`, `npm run test:plans`, `npm run test:tax` all pass with **unmodified expected values**.
- `npm run typecheck`, `npm run lint` clean.
- New test: `updateLaborPosition` rejects a save that leaves a scope's INSTALL allocation off 100.
- New test: `rateFor()` returns `discountedRate` for `LaborRateType.DISCOUNTED`.
- Migrations applied to both databases; `npm run sync:divisions-pii` run if any `Division` rows moved.
