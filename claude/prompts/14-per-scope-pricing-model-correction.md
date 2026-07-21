# Build prompt: per-scope pricing model correction

## Why this exists

Prompts 09–13 were written from the Integrated Systems **Commercial** tab only and wrongly assumed every division shares that structure. They don't. Each division/segment is its own pricing world with genuinely different shapes. This prompt corrects the schema so each scope owns a complete, independently-shaped set, and reseeds all three from the real workbooks. **This supersedes the conflicting parts of prompts 09, 10, 11, and 13, and the "global attributes" decision in prompt 01** (specifics called out per part).

Source of truth — three workbooks now in `claude/prompts/samples/`:
- `is-commercial-master-rate-sheet.xlsx`
- `is-residential-master-rate-sheet.xlsx`
- `cabin-services-master-rate-sheet.xlsx`

**Read every sheet of all three** before implementing. The previously-accepted deviations still hold, but only where they apply (IS estimating labor uses hours-not-dollars; IS-Commercial monthly monitoring uses the $39.99 row only; IS-Commercial SMA Bank of Hours sell rate = Tech 1&2 standard × 0.90). Cabin and Residential don't have those concepts.

## The three scopes (this is the model)

Three independent scopes, each owning its own Materials, Labor Rates, Complexity Multipliers, Attributes, and Recurring/Service pricing. Nothing is shared across scopes.

1. **Integrated Systems — Commercial** (`integrated-systems` / `COMMERCIAL`)
2. **Integrated Systems — Residential** (`integrated-systems` / `RESIDENTIAL`)
3. **Cabin Services** (`cabin-services` / `STR`) — **a single, undivided scope.** Cabin is not split by customer type or tax; STR and residential customers both use this one scope. **This reverts prompt 13**: remove the `CS_STR`/`CS_RESI` split, the `sharedCatalog`/canonical-storage aliasing, and any "Cabin offers two segments" logic. Cabin Services has exactly one scope. (Keep prompt 13's `ScopeSelector` component and the accessible Radix `Select` — those were good; just make Cabin resolve to one scope, and keep Integrated Systems split into its two real segments.)

The `(divisionId, segment)` scoping key stays. Materials catalog is already scoped this way and needs no schema change — IS-Residential and Cabin catalogs are simply empty until imported; that's fine.

## Part 1: Attributes become per-scope (corrects prompt 01)

`MaterialAttribute` is currently global (`slug @unique`, no scope). Ryan wants attributes owned per scope.
- Add `divisionId` + `segment` to `MaterialAttribute`. Change the uniqueness from global `slug` to `@@unique([divisionId, segment, slug])`.
- Update the attribute admin, the attribute-list import/export (prompt 04), and assignment logic to be scope-aware (an attribute belongs to one scope; assignments only link categories and attributes within the same scope).
- Backfill migration: all existing attributes (the 134 options imported earlier were Integrated Systems Commercial) get assigned to `integrated-systems` / `COMMERCIAL`. Do not drop data.

## Part 2: Labor rates — generalize for real per-scope shapes (corrects 09)

The current schema is IS-Commercial-shaped. Fix:
- `LaborRateConfig`: rename `commercialBillingMultiplier` → `standardBillingMultiplier` (Residential and Cabin bill at 1.4, not a "commercial" rate). Add nullable `discountedMultiplier Decimal?` (Cabin uses 0.90; null elsewhere).
- `LaborPosition`: add nullable `discountedRate Decimal?` (Cabin only). Keep `quotedAllocationPct`. **Blend membership is determined by `quotedAllocationPct > 0`, per scope — not by a hardcoded set of four SKUs.** The 100%-sum validation must run over each scope's own blend positions, whatever they are.
- Reseed all three scopes exactly from the workbooks (verify every number against the sheet):

**IS Commercial** (config: burden 1.85, standardBilling 1.89, afterHours 1.45, holiday 1.75; no discount): Tech 1 and 2 `LAB-COM-T12-SIS` 50%, Senior `LAB-COM-SRT-SIS` 20%, Programmer `LAB-COM-PRG-SIS` 15%, Project Manager `LAB-COM-PMG-SIS` 15%, Service Technician `LAB-COM-SVC-SIS` 0%. Blend = first four (sum 100).

**IS Residential** (config: burden 1.85, standardBilling **1.4**, afterHours 1.45, holiday 1.75; no discount): Tech 1/2 `LAB-RES-T12-SIS` **60%**, Senior `LAB-RES-SRT-SIS` **25%**, Programmer `LAB-RES-PRG-SIS` **15%**, Service Technician `LAB-RES-SVC-SIS` 0%. **No Project Manager role.** Blend = first three (sum 100). Rates from sheet (base 18/26/32/22 → billing 46.62/67.34/82.88/56.98, etc.).

**Cabin Services** (config: burden 1.85, standardBilling **1.4**, afterHours 1.45, holiday 1.75, **discount 0.90**): Field Technician `LAB-CBN-FLD-SPC` **70%**, Senior Field Technician `LAB-CBN-SFT-SPC` **20%**, Inspector `LAB-CBN-INS-SPC` **10%**, Contractor Coordination `LAB-CBN-CCO-SPC` **0%** (flat, excluded from blend). Blend = Field+Senior+Inspector (sum 100). Each position also has a discounted rate column (e.g. Field 41.958). SKU suffix is `-SPC`, not `-SIS`.

The two labor engines from 09 (blended quote, flat service) still apply per scope; just drive them off each scope's actual positions.

## Part 3: Complexity multipliers — generalize (corrects 10; this is the biggest change)

The current `ComplexityMultiplier` only models a single percentage applied to total labor. Reality across scopes:
- IS-Com: 10, all `Percentage`, applied to `Total Labor Cost`, categories Structural/Access/Compliance.
- IS-Res: 16, all `Percentage`, applied to `Total Labor Cost` **or `Programming Labor` or `Network Labor`**, categories including Systems Integration, Administrative, Service.
- Cabin: 20, **mixed `Fixed Rate` and `Percentage`**, applied to `Base Package Rate`, categories Amenity/Structural/Mechanical/Technology/Outdoor/Access. Fixed examples: Additional Bathroom $8, ADU $75, Home Theater $18. Percentage examples: Vaulted Ceilings 0.025, Seasonal Access 0.085.

Schema changes:
- `category`: change from the 3-value enum to a **plain `String`** (the sheet's category text). A fixed enum can't hold the real, per-scope category vocabularies and would need a migration every time a new one appears.
- Add `multiplierType` enum `{ PERCENT, FIXED }`.
- Add `appliedTo` enum `{ TOTAL_LABOR, PROGRAMMING_LABOR, NETWORK_LABOR, BASE_PACKAGE_RATE }` (extend if a sheet shows another; these cover all three workbooks today).
- Rename/repurpose `modificationRate` → `value`, and **widen precision to `Decimal(12, 4)`** — it must hold both a percentage (0.08) and a fixed dollar amount (75.00). The current `Decimal(5,4)` can't store 75.
- Carry each multiplier's full description text.

Calculation semantics (branch on `multiplierType` + `appliedTo`):
- **IS estimating labor** (`PERCENT`, `TOTAL_LABOR`/`PROGRAMMING_LABOR`/`NETWORK_LABOR`): adds **hours** (honoring the hours-not-dollars decision), additive not compounded. `TOTAL_LABOR` adds to the whole base-hours figure; `PROGRAMMING_LABOR`/`NETWORK_LABOR` add only to that labor bucket's hours. So the calc needs per-bucket base hours as input for residential, not just one total — expose that in the function signature (`{ totalHours, programmingHours, networkHours }` or similar), and fall back to total when a scope doesn't itemize buckets.
- **Cabin service plans** (`FIXED` or `PERCENT`, `BASE_PACKAGE_RATE`): adjusts the base **plan/package dollar rate**, not hours. `FIXED` adds the dollar amount; `PERCENT` adds `basePackageRate × value`. Additive, not compounded, no cap.

Keep the additive-not-compounded rule and the estimator-visibility breakdown from prompt 10 for all modes. Reseed all three scopes from the sheets (10 / 16 / 20 rows).

## Part 4: Recurring vs. service plans (corrects 11)

"Recurring fees" means different things per scope — do not force one shape onto all:
- **IS Commercial**: keep the existing `RecurringFeeItem` SMA + monthly model as built and seeded (SMA tiers, SVM, Bank of Hours derived from Tech 1&2 × 0.90, monthly services with the $39.99 monitoring row). No change.
- **IS Residential**: the Recurring Fee Structure tab is **empty** — seed nothing. The scope simply has no recurring items yet.
- **Cabin Services**: has **no SMA**. It uses bedroom-count-based service plans. Add a distinct model `ServicePlanRate`:
  - fields: `divisionId`, `segment`, `planType` enum `{ MAINTENANCE, INSPECTION, FULL_SERVICE }`, `sku`, `bedrooms Int?`, `maxBathrooms Int?`, `rate Decimal?` (null when custom), `isCustomQuote Boolean`, `description`, `sortOrder`, `isActive`.
  - Seed from the three Cabin tabs: Maintenance Plan Rates (`MP-*`, e.g. 1BR $125 … 5BR $250, custom quoted), Inspection Plan Rates (`CIP-*`, 1BR $95 … 5BR $175, custom), Full-Service Plan Rates (`FSP-*`, 1BR $185 … 5BR $345, custom).
  - `ServicePlanRate` and `RecurringFeeItem` coexist as separate models; a scope uses whichever fits. Don't shoehorn Cabin plans into `RecurringFeeItem`.

## Part 5: explicitly NOT in this pass (but data is in the fixtures)

These tabs exist in the workbooks but are out of scope for this correction — flag them as available follow-ups, don't build them now:
- **Service Rates** (IS-Commercial): standard/emergency/remote/travel/mileage/lift/minimums.
- **Common Packages** (IS-Commercial): labor-hour package templates (`PKG-*`).
- **Consumables / Shop Supplies** (IS-Commercial and Cabin): keep unbuilt per the earlier consumables decision; the data stays in the fixtures for when the Consumables feature is built.
- **Materials category reseed** (IS-Residential has 197 category rows; Cabin's materials are effectively consumables): the materials catalog is already per-scope; Ryan imports each scope's catalog via the existing import tools. No schema work here.

Do not silently build any of these as a side effect.

## Non-goals

- No quoting/job/ticket/customer entities (still don't exist) — engines stay pure functions driven by per-scope data.
- Don't merge the three scopes' data or share rows across scopes.
- Don't keep the `commercialBillingMultiplier` name or the 3-value complexity category enum.
- Don't reintroduce Cabin's STR/RESI split from prompt 13.
- No Stripe/tax-calc changes.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean; `npm run build` on Ryan's machine.
- Migration backfills existing attributes to IS-Commercial and existing labor/complexity/recurring rows stay intact; no data lost.
- Attributes are scoped: creating an attribute under IS-Residential does not appear under IS-Commercial; assignment respects scope.
- Labor: all three scopes seed with the exact SKUs/rates/percentages above; blend positions per scope sum to 100 (IS-Com 4 roles, IS-Res 3 roles, Cabin 3 roles); Cabin positions carry a discounted rate, others null; `standardBillingMultiplier` is 1.89 for IS-Com and 1.4 for IS-Res and Cabin.
- Complexity: seeds 10 (IS-Com) / 16 (IS-Res) / 20 (Cabin). A Cabin `FIXED` row (e.g. ADU $75) stores value 75.0000 and, applied to a base package rate, adds $75; a Cabin `PERCENT` row (Vaulted 0.025) adds 2.5% of base package rate; an IS-Res `PROGRAMMING_LABOR` row adds hours only to the programming bucket; an IS-Com `TOTAL_LABOR` row adds hours to total. All additive, none compounded.
- Cabin `ServicePlanRate` seeds all three plan types with correct bedroom/rate values and custom-quote rows; Cabin has zero `RecurringFeeItem` rows and no SMA anywhere.
- `ScopeSelector` shows exactly three scopes (IS-Com, IS-Res, Cabin), Cabin as a single entry (no STR/RESI split), across Materials/Labor/Complexity/Recurring pages.
- Update `AGENTS.md` / `.cursor/rules/` to describe the three-scope model, per-scope attributes, the generalized labor (discounted rate) and complexity (type/appliedTo/string category) shapes, and the Cabin `ServicePlanRate` model — and note that this corrected 09–13's IS-Commercial-only assumptions.
