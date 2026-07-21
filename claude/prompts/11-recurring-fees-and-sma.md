# Build prompt: recurring fees + SMA engine (Integrated Systems Commercial)

Build after prompt 09 (it reuses the Tech 1&2 rate for Bank of Hours). Same discipline: rate data + pure calc functions + validation. No customer, contract, or billing entity exists yet — the "does this customer have an active SMA" check is a passed-in boolean for now, not a model to build.

## Source of truth + two Ryan decisions baked in

`claude/prompts/samples/is-com-recurring-fee-structure.csv` (copy the uploaded `...Recurring Fee Structure (1).csv`). Two corrections Ryan confirmed, apply them when seeding:
1. **Monthly Monitoring Service has two conflicting rows** in the CSV ($39.99 base and $18.99 base, same SKU). Seed **only the $39.99 base row** ($51.99 direct / $46.79 bundled). Drop the $18.99 row entirely.
2. **Bank of Hours price is derived, not the CSV's flat values.** Ignore the CSV's $50/$65/$58.50 for `REC-LAB-BOH-ANN`. The sell rate is **Tech 1&2 standard billing rate × 0.90** (= 62.94 × 0.90 = **$56.65/hr** at current rates), read live from prompt 09's `LaborPosition`. Don't store a static BOH price.

Standard markup from the sheet is **30%**, and the consistent pattern across every fixed-price recurring item is: `directPurchaseRate = baseCost × 1.30`, `smaBundledRate = directPurchaseRate × 0.90`. Store the sheet's literal rates as authoritative; encode the pattern as a test assertion.

## Strict architectural separation (the whole point of this prompt)

SMAs and monthly services are **different mechanisms** and must be different types/tables. Do not let them share a pricing path. An SMA is a stacked 3-part annual calculation; a monthly service is a flat subscription with a direct-vs-bundled toggle.

## Data model

`RecurringFeeItem`, scoped by `(divisionId, Segment)`:
- `sku` (unique within scope), `description`, `unit` (`YEAR` | `MONTH`), `baseCost Decimal`, `directPurchaseRate Decimal`, `smaBundledRate Decimal`, `billingCycle` (enum `BillingCycle { ANNUAL, MONTHLY }`), `feeType` (enum below), `valueType` (enum `RateValueType { CURRENCY, PERCENT }`), `systemValueMin`/`systemValueMax` (`Decimal?`, only set on SMA base tiers), `notes String @db.Text`, `isActive`, `sortOrder`.
- `feeType` enum `RecurringFeeType { SMA_BASE_TIER, SMA_SVM, SMA_BANK_OF_HOURS, MONTHLY_SERVICE }`.
- `valueType` exists because the **SVM row's rates are percentages, not dollars** (12% / 15.60% / 14.04%) — store them as decimals (0.1560, 0.1404) with `valueType = PERCENT`. Every other row is `CURRENCY`. Never render or math a PERCENT row as a dollar amount.

### Seed rows (IS-Commercial)

SMA base tiers (`feeType = SMA_BASE_TIER`, `billingCycle = ANNUAL`, `unit = YEAR`, `valueType = CURRENCY`):

| sku | min | max | baseCost | direct | bundled |
|---|---|---|---|---|---|
| `REC-AMA-TR1-ANN` | 500 | 5000 | 375.00 | 487.50 | 438.75 |
| `REC-AMA-TR2-ANN` | 5000 | 10000 | 750.00 | 975.00 | 877.50 |
| `REC-AMA-TR3-ANN` | 10000 | 18000 | 1000.00 | 1300.00 | 1170.00 |
| `REC-AMA-TR4-ANN` | 18000 | 30000 | 1850.00 | 2405.00 | 2164.50 |
| `REC-AMA-TR5-ANN` | 30000 | null (open-ended) | 2300.00 | 2990.00 | 2691.00 |

SVM (`feeType = SMA_SVM`, `valueType = PERCENT`, ANNUAL): `REC-SMA_SVM-ANN`, base 0.12, direct 0.1560, bundled 0.1404.

Bank of Hours (`feeType = SMA_BANK_OF_HOURS`, ANNUAL): `REC-LAB-BOH-ANN` — seed the row for identity/notes but mark its price as derived (see decision 2); do **not** trust its CSV dollar columns.

Monthly services (`feeType = MONTHLY_SERVICE`, `billingCycle = MONTHLY`, `unit = MONTH`, `valueType = CURRENCY`):

| sku | base | direct | bundled |
|---|---|---|---|
| `REC-MON-MON` (Monthly Monitoring, $39.99 row only) | 39.99 | 51.99 | 46.79 |
| `REC-CLD-STG-MON` (Cloud Storage Backup) | 49.99 | 64.99 | 58.49 |
| `REC-CLD-ACP-MON` (Cloud Door Access, per door) | 20.00 | 26.00 | 23.40 |
| `REC-CLD-VMS-MON` (Cloud VMS, per camera) | 20.00 | 26.00 | 23.40 |

## Module A — SMA engine (pure functions)

`Total Annual SMA Price = Base Rate + System Value Modifier + Bank of Hours`

1. `selectSmaBaseTier(systemMaterialValue)` → the one matching `SMA_BASE_TIER` row. Boundary rule (resolve the CSV's overlapping edges): tier1 `[500, 5000]`, tier2 `(5000, 10000]`, tier3 `(10000, 18000]`, tier4 `(18000, 30000]`, tier5 `(30000, ∞)` — i.e. an exact boundary value belongs to the **lower** tier ("not to exceed" is inclusive). A value **below $500** returns no tier → the SMA isn't offered at that size; surface that clearly, don't silently pick tier1.
2. System Value Modifier: `svm = systemMaterialValue × (purchaseType === DIRECT ? 0.1560 : 0.1404)`. **Applied to material value only — never total project value including labor.** Put that in a comment.
3. Bank of Hours (optional): `boh = (Tech1&2.standardBillingRate × 0.90) × bankOfHoursQty`, read live from prompt 09. Zero if not purchased.
4. `calculateAnnualSmaPrice({ systemMaterialValue, purchaseType, bankOfHoursQty })` returns the itemized parts + total. `purchaseType` is an enum `SmaPurchaseType { DIRECT, SMA_BUNDLED }` that selects the base-tier column AND the SVM percentage together.

**Flag for Ryan (don't block):** the CSV isn't explicit about what makes an SMA "direct" vs "bundled" as a contract (the SVM note ties it to purchase type / how the system was acquired). I've modeled `purchaseType` as a single SMA-level input driving both the base tier and SVM column. Confirm that's the intended semantics, or whether base-tier and SVM can ever use different columns.

## Module B — monthly services (flat subscription, pure function)

`resolveMonthlyServiceRate(item, customerHasActiveSma)` → `customerHasActiveSma ? item.smaBundledRate : item.directPurchaseRate`.
- `customerHasActiveSma` is a passed-in boolean. **No customer/SMA-contract entity exists** (reset) — do not build one; this parameter is the seam for when it does, same way `WorkContext`/`customerHasActiveSma` are passed into the tax and labor engines.
- **The SVM (`REC-SMA_SVM-ANN`) must never be applied to a monthly service.** Enforce in types: monthly-service pricing has no SVM parameter at all.

## Zod validation (per the user's explicit requirements)

- SMA calc input requires a resolvable base tier (reject if `systemMaterialValue` yields none).
- `billingCycle` is strictly `ANNUAL` for all SMA feeTypes and strictly `MONTHLY` for `MONTHLY_SERVICE` — a schema refinement that rejects a mismatched pair.
- Bank of Hours discount is strictly 10% off the Tech 1&2 standard rate — assert `bohRate === round(T12.standardBillingRate × 0.90, 2)` in a test.
- SVM cannot appear in a monthly-service input type (structural, not just runtime).

## Admin surface

Light admin list of the recurring items for the scope, admin-gated, inline edit. ~9 rows — no Excel pipeline. Render PERCENT rows as percentages, CURRENCY rows as dollars (respect `valueType`).

## Non-goals

- No customer, SMA-contract, subscription, or invoice entity — pure functions with passed-in inputs only.
- No Stripe/billing calls.
- No proration, renewal, or "hours don't roll over" enforcement logic yet (that's contract-lifecycle work for later; the CSV note about forfeiture is informational for now).
- Don't apply SVM to material+labor — material value only.
- Don't resurrect the CSV's Bank of Hours dollar figures or the $18.99 monitoring row.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Seed lands 5 tiers + SVM + BOH + 4 monthly services (10 rows), $18.99 monitoring absent.
- Test tier selection at boundaries: $5,000 → TR1, $5,000.01 → TR2, $30,000 → TR4, $30,000.01 → TR5, $499 → no tier.
- Worked SMA test: system material value $12,000, purchaseType DIRECT, 10 bank hours → base TR3 direct $1,300.00 + SVM (12,000 × 0.1560 = $1,872.00) + BOH (62.94 × 0.90 × 10 = $566.46) = **$3,738.46**. Confirm exactly.
- Same inputs, purchaseType SMA_BUNDLED → base $1,170.00 + SVM (12,000 × 0.1404 = $1,684.80) + BOH $566.46 = **$3,421.26**.
- `resolveMonthlyServiceRate(monitoring, true)` = 46.79; `(monitoring, false)` = 51.99.
- Confirm the type system makes it impossible to pass SVM into a monthly-service calc or to give an SMA feeType a MONTHLY cycle.
- Confirm BOH rate tracks prompt 09: change the Tech 1&2 standard rate in a test fixture and confirm the BOH sell rate moves with it.
- Update `AGENTS.md` / `.cursor/rules/` with the recurring-fee model, the SMA 3-part engine, and the two Ryan-confirmed deviations from the CSV.
