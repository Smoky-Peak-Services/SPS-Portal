# Build prompt: consumables catalog

Add the Consumables section. It's a sibling to the materials catalog but a **separate, simpler dataset** with one critical scoping difference and one derived-value rule. Build it in the same add / edit / delete fashion as materials.

**What a consumable is (why it's separate):** generic supplies that aren't tied to any specific system and get used on the majority of jobs — pull string, Velcro one-wrap, blank inserts, cable labels, screws, drywall anchors, zip ties, etc. Materials are system-specific line items you quote per job; consumables are the shared shop stock everyone burns through. They are kept in **completely separate catalogs** on purpose: a thing is a consumable *only* because it lives in the consumables catalog, never because of a flag on a material. See the hard separation requirement below.

Fixtures (source of truth for seed + column shapes): `claude/prompts/samples/is-consumables.csv` and `claude/prompts/samples/cabin-consumables.csv`.

## Scope: division-only, NOT per segment

Consumables are **shared across a division's segments.** There is exactly **one consumables dataset per division**: one for Integrated Systems (shared by Commercial and Residential) and one for Cabin Services. No segment split, no other splits.

- New model `ConsumableItem` scoped by **`divisionId` only** (no `segment` column). `@@unique([divisionId, sku])`, `@@index([divisionId])`.
- The Consumables page keys off `getActiveScope().divisionId` and **ignores the segment**. When the active scope is IS-Commercial or IS-Residential, the same IS consumables list shows. When Cabin, the Cabin list. (Segment still matters only for the derived labor rate below.)
- This is deliberately different from materials/labor/complexity which are `(divisionId, segment)`. Don't force consumables into the segment key.

## Derived labor rate — ignore the sheet's stored rate

Both sheets carry a "Labor Rate" column ($62.94 for IS = the Tech 1&2 rate; $46.62 for Cabin). **Do not store or use those.** Per Ryan: the labor rate applied to a consumable is the **division's blended install labor rate**, derived — not a single position's rate, not a stored value.

- The blended rate comes from the existing labor engine: `distributeQuotedLabor(1 hour, <scope INSTALL positions>, rateType).billable` is the blended $/hr for that `(divisionId, segment)`. Reuse it (or add a thin `blendedInstallRate(divisionId, segment, rateType)` wrapper around it) — do not hardcode or duplicate the blend math.
- A consumable stores **labor UNITS** (hours to handle/install one unit — Cabin's sheet has these, e.g. 0.025, 0.05, 1.25; IS has none → default 0). Labor **cost** for a consumable = `laborUnits × blendedInstallRate(scope)`, computed at use time. Never store the rate.
- Because consumables are division-shared but the blend differs by segment (IS-Commercial blend ≠ IS-Residential blend), the rate is resolved against the **active scope's segment** for display, and against the job's scope later when consumed. On the Consumables page, show the derived blended rate for the active scope as a read-only reference column (and the resulting labor cost = laborUnits × that rate), clearly labeled "derived from blended labor rate," so it's obvious it tracks the labor sheet and isn't a stored number.

## Model `ConsumableItem`

Unify both sheets' columns (some fields only apply to one division — nullable):

- `divisionId`, `division` relation.
- `description` (required).
- `sku` (required, unique per division).
- `category` `String?` — IS uses it (Fasteners, Tape, Connectors, …); Cabin doesn't (null).
- `manufacturer` `String?` — Cabin (DURACELL, GE, …); IS null.
- `partNumber` `String?` — Cabin; IS null.
- `unit` `String` (unit of measure: Pack, Roll, Each, EACH, Bucket, "FLUID OUNCES", …).
- `wasteFactorPct` `Decimal @default(0)`.
- `baseCost` `Decimal?` — nullable to support market-rate pass-through (see below).
- `isMarketRate` `Boolean @default(false)` — true for pass-through items priced at market (Cabin "LIQUID PROPANE (PRODUCT PASS-THRU)" has `MRKT RATE` for cost and sale). When true, `baseCost`/sell price are null and the UI shows "Market rate."
- `markupPct` `Decimal` — per-item, editable. Division defaults: **IS 0.50** (50%), **Cabin 0.30** (30%). (Verified: IS billing = base × 1.5; Cabin sale = cost × 1.3.)
- `laborUnits` `Decimal @default(0)` — hours per unit (Cabin populated; IS 0).
- `supplier` `String?` — IS "Supplier" column (Amazon, …). Keep distinct from `manufacturer` (where-bought vs who-made).
- `notes` `String?`, `isActive Boolean @default(true)`, `sortOrder Int @default(0)`, timestamps.

Derived (compute, don't store): `sellPrice = round(baseCost × (1 + markupPct))` when not market-rate; `laborRate` = blended install rate for the active scope; `laborCost = laborUnits × laborRate`.

This is a **new model, fully separate from `MaterialItem`.**

## Hard separation: remove the material-as-consumable flag entirely

Right now a material can be *flagged* as a consumable — `MaterialItem.isConsumable` exists and is wired into `item-form.tsx` (a checkbox that reveals `baseCost` / `markupPct` / `wasteFactorPct` pricing fields on the material). Ryan wants this gone: nobody should be able to label a material as a consumable, because it makes "what is what" ambiguous. A consumable is a consumable *only* by living in the `ConsumableItem` catalog.

Remove it end to end:
- Drop `MaterialItem.isConsumable` (schema + migration).
- Drop the consumable-only pricing fields that exist solely to support that flag — `baseCost`, `markupPct`, `wasteFactorPct` on `MaterialItem` (materials store no pricing; material pricing is obtained at quote time — those columns only existed for the consumable hack; consumable pricing now lives on `ConsumableItem`). **Before dropping each, grep for other uses;** if one is genuinely used for a non-consumable material purpose, keep that one and only remove the `isConsumable`-driven behavior — but by inspection today they're only set when `isConsumable` is true.
- Remove the checkbox and the revealed base/markup/waste fields from `item-form.tsx`, the `isConsumable` handling in `actions.ts` (create/update item), the `isConsumable` field in `schemas.ts`, and the reference in `materials/items/[id]/page.tsx`.
- Migration must not destroy data unexpectedly: if any existing `MaterialItem` rows are currently flagged `isConsumable = true`, surface them to Ryan (list their names) rather than silently dropping — they likely belong in the new consumables catalog and he may want to re-enter/move them. (In practice there may be none; check.)

## UI + CRUD (same fashion as materials)

- Activate the Consumables tab in `src/app/(portal)/materials/layout.tsx` — it's currently `{ label: "Consumables", disabled: true }`. Remove the disabled/"Soon" state and point it at a real route (`/materials/consumables`).
- A consumables list page under the active division: table of items with add / edit / delete, admin-gated (`requireArea("materials")` or the existing materials write permission), same interaction pattern and styling as the materials category/item admin. Inline edit or an edit form, whichever matches how materials items are edited today — be consistent, don't invent a new pattern.
- Delete is a straightforward hard delete (consumables are leaf items with no dependents yet); confirm-on-delete like the materials delete controls.
- Show columns: description, sku, category/manufacturer, unit, waste %, base cost (or "Market rate"), markup %, sell price (derived), labor units, derived labor rate + labor cost (reference). Respect market-rate rows.
- Empty state per division ("No consumables for Cabin Services yet — add one or import.") consistent with the materials empty states.

## Seed

Seed both datasets from the fixtures:
- IS (`is-consumables.csv`) → `integrated-systems`, ~23 items, markup 0.50, category populated, laborUnits 0, no manufacturer/partNumber.
- Cabin (`cabin-consumables.csv`) → `cabin-services`, ~35 items, markup 0.30, manufacturer/partNumber populated, laborUnits from the sheet, no category. Includes the `SVC-` service-fee rows (propane exchange/refill/disposal) — seed them as consumable entries as-is (their SKU prefix marks them; no special handling needed now).
- Map `MRKT RATE` rows to `isMarketRate = true`, null cost.
- **Flag, don't auto-fix, this data anomaly:** the Cabin "50W DAYLIGHT WHITE 5000K MR16 LED BULB" row has Sale Price $0.80 against a $2.65 unit cost (every other bulb sells at cost × 1.3 ≈ $3.45) — almost certainly a typo in the sheet. Import it as-is but surface it in a "review these" note (or a warning on that row) rather than silently correcting or silently importing a bad price. Ryan decides.

## Optional (mention, don't over-build)

A flat Excel/CSV import-export for consumables (one sheet per division) would match the materials workflow and how this data originates. Nice to have, not required for this pass — CRUD + seed is the ask. If you add it, keep it to the same two-phase preview/commit, non-destructive-upsert pattern used elsewhere; if not, leave a clean seam.

## Non-goals

- No quote/ticket/job consumption logic — consumables aren't billed anywhere yet; this is the catalog + CRUD only.
- Don't store the labor rate; it's always derived from the blended labor rate.
- No tax/Stripe fields for now (consumables are typically rolled up, not itemized — per the sheet note); add later if needed.
- Don't add a segment column to consumables or otherwise split the dataset.
- Don't add any "is consumable" flag or type toggle to materials to replace the removed one — the separation is by catalog, full stop.
- Don't change the labor engine or the scope switcher beyond consuming them.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean; `npm run build` on Ryan's machine.
- One consumables dataset per division: IS list identical whether active scope is IS-Commercial or IS-Residential; Cabin shows its own.
- Seeds land ~23 IS + ~35 Cabin items with correct markups; market-rate propane row shows "Market rate"; the MR16 anomaly is flagged, not silently altered.
- Sell price = base × (1 + markup) and recomputes when base or markup is edited; market-rate rows show no computed sell price.
- The reference labor rate on the page equals the active scope's blended install rate (changes if you switch IS-Commercial ↔ IS-Residential, because their blends differ), and it's clearly labeled as derived — no stored $62.94/$46.62 anywhere.
- Add, edit, and delete all work and persist; delete confirms first.
- Consumables tab is enabled (no "Soon") and routes to the page.
- `MaterialItem.isConsumable` and its checkbox/pricing-field UI are gone: grep for `isConsumable` returns nothing in `src/` (migrations aside); the material item form no longer offers a "consumable" option.
- Update `AGENTS.md` / `.cursor/rules/` to document `ConsumableItem` (division-only scope, derived blended labor rate, one dataset per division).
