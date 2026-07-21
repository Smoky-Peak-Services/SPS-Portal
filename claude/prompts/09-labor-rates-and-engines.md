# Build prompt: labor rates + quoted/service labor engines (Integrated Systems Commercial)

First pricing-catalog phase. Same discipline as the materials tax work: build the **rate reference data + pure calculation functions + validation**, not the things that consume them. There is no Quote, Job, or ServiceTicket entity yet (they were reset — see AGENTS.md §2a), so nothing here attaches to one. The engines are pure functions with unit tests, ready for quoting/estimating to call later — exactly like `resolveLaborTaxCode` was built ahead of any billing code.

## Source of truth

All rates, SKUs, and percentage splits come **strictly** from `claude/prompts/samples/is-com-hourly-labor-rates.csv` (copy the uploaded `Integrated Systems Commercial Master Rate Sheet - Hourly Labor Rates.csv` there as a fixture). Every number below was read from that file — do not round, invent, or "improve" any rate.

## Scope

Scope this to Integrated Systems + Commercial only for now, using the **same `(divisionId, Segment)` pattern already used by `MaterialDomain`** (division = `integrated-systems`, segment = `COMMERCIAL`). Seed only IS-Commercial data. The model must be scope-able so other divisions/segments get their own rate sets later — do not hardcode "IS Commercial" into the schema, only into the seed.

## Data model

### `LaborRateConfig` (one row per division+segment)
The global multipliers from the top of the sheet, kept for transparency and future re-derivation (they're not applied at runtime — the per-position rates below are the authoritative stored values — but they document how those rates were produced and let an admin recompute if a base rate changes):
- `burdenMultiplier` = **1.85**, `commercialBillingMultiplier` = **1.89**, `afterHoursMultiplier` = **1.45**, `holidayMultiplier` = **1.75** (all `Decimal`).
- `standardMarkupPct` isn't on this sheet; leave it out here (it lives in the recurring-fee prompt).

### `LaborPosition` (one row per role, scoped by division+segment)
Store the sheet's literal values as the authoritative sell/cost rates:

| title | sku | baseHourlyRate | actualCostOfLabor | standardBillingRate | afterHoursRate | holidayRate | quotedAllocationPct | context |
|---|---|---|---|---|---|---|---|---|
| Tech 1 and 2 | `LAB-COM-T12-SIS` | 18.00 | 33.30 | 62.94 | 91.26 | 110.14 | 50.0 | INSTALL |
| Senior Technician | `LAB-COM-SRT-SIS` | 26.00 | 48.10 | 90.91 | 131.82 | 159.09 | 20.0 | INSTALL |
| Programmer | `LAB-COM-PRG-SIS` | 32.00 | 59.20 | 111.89 | 162.24 | 195.80 | 15.0 | INSTALL |
| Project Manager | `LAB-COM-PMG-SIS` | 43.00 | 79.55 | 150.35 | 218.01 | 263.11 | 15.0 | INSTALL |
| Service Technician | `LAB-COM-SVC-SIS` | 22.00 | 40.70 | 76.92 | 111.54 | 134.62 | 0.0 | SERVICE |

- All money columns `Decimal @db.Decimal(12, 2)`; `quotedAllocationPct` `Decimal @db.Decimal(5, 2)`.
- `sku` unique within scope.
- `context`: **reuse the existing `WorkContext` enum (`INSTALL` | `SERVICE`)** rather than inventing a new `JOB_QUOTE`/`SERVICE_TICKET` enum. The user's spec named them `JOB_QUOTE`/`SERVICE_TICKET`, but that's the same axis the tax work already models as `INSTALL`/`SERVICE` (quoted job = INSTALL, service ticket = SERVICE). Reusing one enum prevents two enums that mean the same thing from drifting apart — the exact kind of duplication this project avoids. Map: the four blended roles are `INSTALL`, the Service Technician is `SERVICE`. If you'd rather keep the user's literal names, that's a deliberate call — but don't create a second enum silently; pick one and document it.

### Enum `LaborRateType { STANDARD, AFTER_HOURS, HOLIDAY }`
The three billable rate columns, selectable per job/ticket.

## Verified derivation (for the recompute helper and unit-test assertions)

These all reproduce the sheet exactly — encode them in a test so a future rate edit that breaks the relationship is caught:
- `actualCostOfLabor = baseHourlyRate × 1.85` (Tech1&2: 18 × 1.85 = 33.30 ✓)
- `standardBillingRate = actualCostOfLabor × 1.89` (33.30 × 1.89 = 62.94 ✓)
- `afterHoursRate = standardBillingRate × 1.45` (62.94 × 1.45 = 91.26 ✓)
- `holidayRate = standardBillingRate × 1.75` (62.94 × 1.75 = 110.14 after rounding ✓)

Store the literal sheet values as authoritative; the multipliers are for a `recomputeRates(config, baseHourlyRate)` verification helper, not the runtime path.

## Module A — quoted labor (weighted blended engine), pure function

`distributeQuotedLabor(totalHours, positions, rateType)`:
- Uses only `context === INSTALL` positions (the four blended roles). **The Service Technician (`LAB-COM-SVC-SIS`) must never appear in this calculation, a quote line, or any estimating template.**
- Per role: `roleHours = totalHours × (quotedAllocationPct / 100)`.
- `billable = Σ (roleHours × role.rateFor(rateType))`; `costBasis = Σ (roleHours × role.actualCostOfLabor)`.
- Returns the per-role breakdown (hours, rate used, billable, cost) plus totals and blended margin.
- Note on cost basis: the sheet has a single `actualCostOfLabor` per role with no after-hours/holiday cost variant, so `costBasis` is the same regardless of `rateType`. That means an after-hours or holiday job shows an inflated margin because the bill rises but the modeled cost doesn't. **Flag this in a code comment** — if Ryan wants true off-hours margin, an after-hours/holiday cost multiplier would need to be added to the sheet; not inventing one here.

## Module B — service ticket labor (flat/direct engine), pure function

`calculateServiceTicketLabor(hoursLogged, rateType)`:
- Uses only the Service Technician (`LAB-COM-SVC-SIS`). No percentage distribution.
- `billable = hoursLogged × svc.rateFor(rateType)`; `costBasis = hoursLogged × svc.actualCostOfLabor`.
- Keep this in a separate function/module from Module A so the two engines can never cross-contaminate.

## Zod validation (guardrails, per the user's explicit requirements)

- A `quotedAllocationSchema` that refines the set of `INSTALL` positions to sum to **exactly 100.0%** (use a small float tolerance, e.g. abs diff < 0.001, since these are decimals).
- A refinement that **rejects any `SERVICE`-context position (specifically `LAB-COM-SVC-SIS`) appearing in a quoted-distribution input** — fail validation loudly, don't silently drop it.
- `LaborRateType` parsed as the enum; reject unknown rate types.

## Admin surface (light — these are 5-row tables, not 115)

A read/edit admin page under `/materials`-adjacent routing (e.g. `/pricing/labor-rates` or wherever fits the nav) showing the positions and config for the scope, admin-gated (`requireArea`). Inline edit is fine — **do not** build a full Excel import/export pipeline for this; five rows per scope doesn't warrant it (unlike the 115-category tax data). If Ryan later wants Excel round-trip to sync from his master rate sheet, that's a quick fast-follow, not this pass.

## Non-goals

- No Quote/Job/ServiceTicket/Estimate model or UI — the engines are pure functions with nothing attached, same as `resolveLaborTaxCode`.
- No complexity multipliers here (that's prompt 10, which feeds adjusted hours *into* `distributeQuotedLabor`).
- No recurring/SMA logic (prompt 11).
- No Stripe calls or tax calc.
- Don't build after-hours/holiday cost variants that aren't in the sheet.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Seed lands exactly 5 positions + 1 config for IS-Commercial with the exact SKUs and rates above.
- Unit test: `distributeQuotedLabor(100, ..., STANDARD)` → Tech1&2 50h, Senior 20h, Programmer 15h, PM 15h; billable = 50×62.94 + 20×90.91 + 15×111.89 + 15×150.35 = 3147.00 + 1818.20 + 1678.35 + 2255.25 = **$8,898.80**; confirm the function reproduces this.
- Unit test: the same call under `AFTER_HOURS` and `HOLIDAY` uses the right columns and cost basis stays constant (with the flagged-margin comment).
- Unit test: passing `LAB-COM-SVC-SIS` into the quoted engine or a distribution summing ≠ 100% fails Zod.
- Unit test: `calculateServiceTicketLabor(3, STANDARD)` = 3 × 76.92 = **$230.76**.
- `recomputeRates` reproduces every stored rate from base × multipliers.
- Update `AGENTS.md` / `.cursor/rules/` with the labor-rate models and the two engines.
