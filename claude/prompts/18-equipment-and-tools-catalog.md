# Build prompt: equipment & tools catalog

The simplest catalog. Equipment & tools = specialized testing equipment, rentals, lifts, and the like. Every item is a **pass-through cost with a hard-baked 15% markup**. That's the whole thing.

Build it the same way as consumables (prompt 17): division-scoped, add / edit / delete. There is **no starting list** — it begins empty and Ryan adds items.

## Scope: division-only, shared across segments

Identical scoping to consumables. **One equipment list per division** — Integrated Systems has one (shared by Commercial and Residential), Cabin Services has one. No segment split.
- Model `EquipmentItem` scoped by **`divisionId` only** (no `segment` column). `@@index([divisionId])`; unique on `@@unique([divisionId, name])` (or `(divisionId, sku)` if you prefer, but `sku` is optional here so a name-based unique is cleaner).
- The page keys off `getActiveScope().divisionId` and ignores segment — same as the consumables page. IS-Commercial and IS-Residential show the same equipment list; Cabin shows its own.

## Pricing: pass-through cost × hard-baked 15% markup

- `sellPrice = round(cost × 1.15)`. The 15% is a **constant in code** (e.g. `export const EQUIPMENT_MARKUP = 1.15`), **not a stored column, not a per-item field, not a per-division setting, not editable anywhere in the UI.**
- Example that must hold: cost $475.00 → sell **$546.25**.
- `sellPrice` is derived (computed on read/display), never stored as an authoritative column. Show it read-only next to the cost.

## Model `EquipmentItem`

- `divisionId`, `division` relation.
- `name` (required) — e.g. "Boom/Scissor Lift Rental".
- `sku` `String?` (optional — no master list to seed SKUs from; Ryan can add one).
- `unit` `String?` (e.g. DAY, WEEK, EACH — rentals are often per day/week; default "EACH" or leave blank).
- `cost` `Decimal @db.Decimal(12, 2)` (required — the pass-through cost, e.g. 475.00).
- `supplier` `String?` (optional — the rental vendor).
- `notes` `String?`, `isActive Boolean @default(true)`, `sortOrder Int @default(0)`, timestamps.

Editable fields: name, sku, unit, cost, supplier, notes. **Not editable:** markup and sell price (sell price is derived from cost × the constant).

## UI + CRUD

- Add an **"Equipment & Tools"** tab under the Catalog section (`src/app/(portal)/materials/layout.tsx`, alongside Materials / Recurring Fees / Catalog I/O / Consumables), routed to `/materials/equipment`.
- List page scoped to the active division: table with add / edit / delete, admin-gated, same interaction/styling as the consumables and materials item admin — be consistent, don't invent a new pattern.
- Columns: name, sku, unit, cost, sell price (derived, read-only, labeled e.g. "Sell (cost + 15%)"), supplier. Delete confirms first (leaf items, hard delete).
- Per-division empty state ("No equipment or tools for this division yet — add one.") since there's no seed.

## Non-goals

- No seed data (no list exists).
- Markup is fixed at 15% in code — no UI to change it, no per-item/per-division override, ever.
- No quote/job/ticket consumption logic — catalog + CRUD only.
- No segment column or dataset split.
- No labor rate, tax, or attributes on equipment — it's purely a pass-through cost + fixed markup.
- Don't touch materials, consumables, the labor engine, or the scope switcher beyond consuming the active division.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean; `npm run build` on Ryan's machine.
- Adding an item with cost 475.00 shows sell price **546.25**; editing cost recomputes it; sell price is not directly editable.
- The 15% is a single code constant — grep confirms no markup column on `EquipmentItem` and no UI field for it.
- One equipment list per division: identical whether active scope is IS-Commercial or IS-Residential; Cabin has its own separate list.
- Add / edit / delete all work and persist; delete confirms first.
- "Equipment & Tools" tab appears under Catalog and routes to the page.
- Update `AGENTS.md` / `.cursor/rules/` to document `EquipmentItem` (division-only scope, pass-through cost + hard-baked 15% markup, one list per division).
