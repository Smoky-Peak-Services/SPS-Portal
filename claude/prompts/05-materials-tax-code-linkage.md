# Build prompt: real Stripe tax codes + material/labor tax linkage

This is reference-data and classification work, not billing work. Nothing here calls Stripe, computes a tax amount, or touches jobs/tickets — those don't exist yet. The point is: when quoting and job costing do get built, the correct material tax code and the correct labor tax code for every catalog item are already sitting there waiting to be read, not re-derived from scratch under deadline pressure.

## A note on sourcing, read before anything else

The case is **Security Equipment Supply, Inc. v. Richard H. Roberts, Commissioner of Revenue** (Tenn. Ct. App. Nov. 28, 2016, No. M2016-00423-COA-R3-CV) — confirmed by reading the actual opinion, not assumed. A second source Ryan pointed to — the TN Alarm Systems Contractors Board's February 2017 meeting minutes — couldn't be retrieved directly in this environment (no browser access, PDF wouldn't render through the fetch tool), but per Ryan (who has read it): the board reviewed the SES ruling at that meeting and, working from it, treated conduit, cable, and installed systems generally as falling under the same real-property/component-part treatment, with a small set of specific carve-outs. That's a second, independent point of confirmation for the general default below, on top of the case itself.

Important nuance, in Ryan's own words: the classification below (the specific TPP exception list) is **his own judgment**, and it deliberately differs from the board's exact carve-out list in places, based on other parts of the law he's weighing that aren't captured in either of these two sources alone. Don't treat the board minutes as a checklist to reconcile the exception list against — Ryan's stated list (software/licenses, patch cables, servers, workstations, hard drives) is the one to build from. If it ever needs to change, that's a business decision he makes, not something to "correct" back toward the board minutes' specific wording.

There's also a second, separate consequence of this classification that matters independently of what Stripe charges the end customer: under the *SES* reasoning, Smoky Peak (as the installing contractor) is the deemed retail consumer of materials that go into a real-property installation — which means Smoky Peak itself owes sales/use tax on those materials when it buys them (self-assessed as use tax if a vendor doesn't collect it at purchase), separately from whatever it bills its own customer. Two different tax obligations sit on top of the same `taxProfile` classification: what Smoky Peak owes upstream on the purchase, and what gets billed downstream to the customer. This prompt only builds the classification data both of those need — it does not build use-tax remittance tracking. (For reference when that does get built: the prior SPS Portal build already modeled this as a `UseTaxAccrual` table with a `REALTY_MATERIAL` reason code — worth a look then, not now.)

What the SES case actually decided, precisely, so this doesn't get overclaimed: it's a **Business Tax Act** case (Tenn. Code Ann. §§ 67-4-701 to -730 — the gross-receipts privilege tax on businesses operating in TN), not a sales-and-use-tax case, and it's about how the *equipment distributor* (SES) gets taxed on *its* sales to licensed alarm contractors — not directly about what a contractor charges its own end customer. SES sold burglar-alarm and access-control equipment (keypads, motion detectors, cameras, control panels, power supplies, card readers, wiring) to licensed alarm contractors, who installed it into homes and businesses as complete systems. SES argued those sales were "wholesale" (sale for resale, lower tax rate); the court held they were "retail" sales, because Tennessee's Business Tax Rule 47(5) treats a contractor who "installs property... in a structure, as a component part thereof" as the retail end-consumer of that property, not a reseller of it. The court explicitly rejected the idea that the equipment needs to be a permanent, non-removable **fixture** for that to apply: "Subsection 5 does not require that the property that is installed constitute a 'fixture' or be permanently assimilated into realty... the rule states that sales to a contractor will be considered 'retail sales' if the contractor installs property... as a component part of a structure." Cameras, card readers, and control panels counted, even though they're not bolted-in-forever the way a strict fixture-law test would require.

Applied to Smoky Peak (which sits in the position of SES's contractor-customers in this fact pattern, not SES itself): the relevant principle isn't a direct sales-tax ruling on what to charge an end customer, but it does support the classification logic Ryan described — **installed security/access-control/AV hardware counts as integrated into the structure, and doesn't need to be permanently affixed to get that treatment**, which is exactly why card readers, locks, and cabling default to `REAL_PROPERTY` below while general-purpose, easily-swapped IT equipment (servers, workstations, hard drives) and non-installed consumables (patch cables) and intangible items (software/licenses) are carved out as `TPP`. That carve-out logic is Ryan's own business classification, informed by this case's reasoning — not something the case rules on directly, and not a substitute for an actual sales-tax opinion from Smoky Peak's accountant or a TN tax attorney if this classification is ever challenged. Treat what follows as a well-informed default, not a legal conclusion.

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
- Don't encode the case as settled sales-tax law in code comments — it's a Business Tax Act case about a distributor's own tax classification, used here as supporting reasoning for a business decision, not as a direct sales-tax ruling. Comment the classification as "per Ryan's classification, informed by *SES v. Roberts* — see `05-materials-tax-code-linkage.md`," not as case-law-mandated.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Seed `StripeTaxCode` from the CSV, confirm exactly 672 rows land.
- Confirm `MaterialCategory`/`MaterialItem` `stripeTaxCode` pickers only allow selecting real seeded codes.
- Create one `REAL_PROPERTY` test item and one `TPP` test item (e.g. a card reader vs. a workstation); call `resolveLaborTaxCode` for both under both `INSTALL` and `SERVICE`, confirm all four results match the table above exactly.
- Confirm existing categories show up in a "needs tax review" view and aren't silently reclassified by the default change.
- Update `AGENTS.md` / `.cursor/rules/` with the new `StripeTaxCode` reference table and the labor tax code resolver, same as every prior phase.
