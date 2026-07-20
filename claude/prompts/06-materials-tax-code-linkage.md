# Build prompt: real Stripe tax codes + material/labor tax linkage

This is reference-data and classification work, not billing work. Nothing here calls Stripe, computes a tax amount, or touches jobs/tickets — those don't exist yet. The point is: when quoting and job costing do get built, the correct material tax code and the correct labor tax code for every catalog item are already sitting there waiting to be read, not re-derived from scratch under deadline pressure.

## A note on sourcing, read before anything else

Ryan asked for this classification to follow how a specific Tennessee case ("SES vs Roberts") treats security/AV system installs for tax purposes. I don't have web search available in this environment and couldn't independently verify that citation or its holding — I'm not going to represent case law I haven't confirmed. What follows is built from two things I *can* verify directly: the real Stripe product tax code list Ryan provided (`claude/prompts/samples/product_tax_codes.csv`, 672 codes, exact IDs and descriptions quoted below), and Ryan's own stated classification rule for this catalog: **most Integrated Systems hardware is a real property improvement, except software/licenses, patch cables, servers, workstations, and hard drives, which are tangible personal property (TPP).** That rule is Ryan's business call, sourced from him — treat it as the input to this work, not as something this prompt is independently asserting as settled law. If Cursor or Ryan want the underlying case reasoning double-checked before this ships, that's a manual lookup to do separately, not something to skip past.

## Part 1: real Stripe tax codes as reference data, not free text

Today, `MaterialCategory.stripeTaxCode` and `MaterialItem.stripeTaxCode` are bare `String?` columns — nothing stops a typo from reaching Stripe. Fix that:

- Add a `StripeTaxCode` model: `id` (the real code, e.g. `txcd_99999999`, as the primary key — not a generated cuid), `name`, `description`, `type` (`physical` | `services` | `digital`), `performanceLocationRequirement`.
- Seed it from `claude/prompts/samples/product_tax_codes.csv` (672 rows, already in the repo) via a script under `prisma/` or `scripts/`, following whatever seeding convention `prisma/seed.ts` already uses.
- Change `MaterialCategory.stripeTaxCode` and `MaterialItem.stripeTaxCode` to a real foreign key to `StripeTaxCode.id` (nullable, same override-inheritance semantics as today: item overrides category). Update the admin forms (`category-form.tsx`, `item-form.tsx`) to pick from a searchable list instead of a free text box — 672 options needs a combobox with search, not a plain `<select>`.

## Part 2: category tax profile — fix the default, and add exceptions explicitly

`MaterialCategory.taxProfile` currently defaults to `TPP`. Per Ryan's rule above, that's backwards for this catalog — most of what Integrated Systems installs is a real property improvement (access control panels, locks, card readers, cameras, cabling — things that get physically integrated into the building). Change the default to `REAL_PROPERTY`, and make sure these specific categories/items are explicitly set to `TPP` (an override, not the inherited default) once they exist in the catalog: **software and licenses, patch cables, servers, workstations, hard drives.**

Don't bulk-flip existing category rows as part of this migration — a `@default` change only affects new rows going forward, and silently reclassifying already-created categories without a human looking at each one is exactly the kind of automatic behavior this project's guardrails exist to prevent. Instead, add a `taxReviewed: Boolean @default(false)` column to `MaterialCategory`, and surface a filtered "needs review" view in the categories admin page so Ryan can walk through and confirm (or correct) every existing category's `taxProfile` deliberately, once, rather than trusting a bulk migration to get it right.

## Part 3: labor tax code — derived, not stored per category

Ryan's actual requirement: when a quote or ticket eventually bills labor for an item, Stripe needs the labor's tax code too, and it depends on two things — the item's real-property-vs-TPP classification (already modeled), and whether the work is an **install** (a quoted job, new work) or a **service** (a ticket, repair/maintenance on existing work). Don't add per-category install/service tax code columns — the real Stripe tax code list already has exactly the codes needed to derive this from what's already modeled:

| Tax profile | Work context | Stripe code | Description (verbatim from the CSV) |
|---|---|---|---|
| `REAL_PROPERTY` | `INSTALL` | `txcd_20020010` | "Installation of Hardware - Permanent" — "A labor charge to install hardware where the installed property is permanently attached to the real property." |
| `REAL_PROPERTY` | `SERVICE` | `txcd_20080007` | "Repairs to Real Property" — "A charge to repair or maintain real property including repairs to HVAC, electrical, flooring, and so on." |
| `TPP` | `INSTALL` | `txcd_20020018` | "Installation of Tangible Personal Property" — "A charge separately stated from any sale of the product itself for the installation of tangible personal property." |
| `TPP` | `SERVICE` | `txcd_20080005` | "Repair of Tangible Personal Property" — general default. Use the more specific `txcd_20080010` ("Computer Repair" — "A charge to repair or restore to operating condition computer hardware...") for the computer-ish TPP exceptions (servers, workstations, hard drives) instead of the general code. |

Build this as:

- A `WorkContext` enum: `INSTALL | SERVICE`. This doesn't attach to anything yet (no job/ticket model exists) — it exists so the resolver function below has a real, typed second input, ready for quoting/job-costing to pass in later.
- A small seed table or config mapping (`taxProfile`, `workContext`) → default `StripeTaxCode`, covering the four rows above, with room for a category/item-level override (e.g. the servers/workstations/hard drives exception routing to Computer Repair instead of the generic TPP repair code) — same override-then-default shape as `resolveItemTaxClassification` in `src/features/materials/tax.ts`.
- A `resolveLaborTaxCode(item, category, workContext)` function alongside the existing `resolveItemTaxClassification` in `tax.ts`: item-level labor override (if one is ever set) → category-level labor override (if one is ever set) → the derived default from the table above based on the item's resolved `taxProfile`. Same "never invent a code, leave it null and flag it if nothing resolves" discipline as the existing function.

Don't build anything that consumes `WorkContext` yet — no job/ticket UI, no "this quote is an install" toggle. That's real work for whenever quoting and the unified work-order model get built, and it should read from what this prompt sets up, not redo the tax-code research.

## Non-goals for this pass

- No Stripe API calls (no `stripe.taxCalculations`, no live rate lookups).
- No job/ticket/quote model changes — `WorkContext` is a standalone enum with nothing attached to it yet.
- No bulk reclassification of existing category data — flag for review, don't auto-correct.
- No attempt to encode the underlying legal reasoning in code or comments as settled fact, given the citation is unverified — comment the classification as "per Ryan's classification, see `06-materials-tax-code-linkage.md`," not as case-law-backed.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Seed `StripeTaxCode` from the CSV, confirm exactly 672 rows land.
- Confirm `MaterialCategory`/`MaterialItem` `stripeTaxCode` pickers only allow selecting real seeded codes.
- Create one `REAL_PROPERTY` test item and one `TPP` test item (e.g. a card reader vs. a workstation); call `resolveLaborTaxCode` for both under both `INSTALL` and `SERVICE`, confirm all four results match the table above exactly.
- Confirm existing categories show up in a "needs tax review" view and aren't silently reclassified by the default change.
- Update `AGENTS.md` / `.cursor/rules/` with the new `StripeTaxCode` reference table and the labor tax code resolver, same as every prior phase.
