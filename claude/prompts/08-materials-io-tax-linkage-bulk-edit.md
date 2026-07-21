# Build prompt: bulk-editable tax/linkage import-export, scoped per page

## Why this is urgent

Ryan is currently hand-editing every category's tax classification through `category-form.tsx`, one category at a time, in the browser — 73 of 115 done, ~5 hours in. The reason he can't do this in bulk in Excel like everything else in this catalog: `05-materials-tax-code-linkage.md` added `taxProfile`, `taxReviewed`, `stripeTaxCodeId`, `laborInstallTaxCodeId`, `laborServiceTaxCodeId` to `MaterialCategory` and `MaterialItem`, but the import/export pipeline built in `02-materials-import-export.md` (`io.ts`, `ExportCategory`, `ITEM_HEADERS`) predates that and only ever knew about `name`/`unit`/`laborUnits`/`laborUnitNotes`. There is currently no bulk path for tax data at all — the columns exist in Postgres and nowhere else.

**If you build nothing else from this prompt, build Part 1 (Categories bulk tax export/import) first and ship it before touching the rest.** That's the piece actively costing Ryan hours today. Parts 2–4 matter but aren't on fire.

## The shape Ryan asked for

- The main `/materials` dashboard page: one "Export everything" action — the whole catalog, all linkage, all tax data, in a readable multi-sheet workbook.
- Each list page (`/materials/categories`, `/materials/items`, `/materials/attributes`, `/materials/domains`) gets its own scoped Export/Import right on that page — not buried in the separate `/materials/import-export` hub. That hub page can stay as-is; it doesn't need to be removed, just don't treat it as the only place these actions live.
- Category and item exports specifically must carry the tax/linkage columns — that's the whole point.

## Part 1 (do this first): flat Categories tax/linkage export-import

This is a **new, separate format** from the nested sheet-per-domain catalog layout — a plain flat table, one row per category, because bulk-editing a column (fill-down, copy-paste across similar rows) only works cleanly when every row has the same shape. The nested sectioned format interleaves category and item rows, which is exactly why it's unusable for what Ryan needs here.

**Columns**, one sheet named `Categories`:

| Column | Source | Notes |
|---|---|---|
| `domain` | `MaterialDomain.name` | for matching + readability |
| `category` | `MaterialCategory.name` | |
| `slug` | `MaterialCategory.slug` | reference only, ignored on import — helps Ryan tell apart same-named categories in different domains |
| `taxProfile` | `REAL_PROPERTY` \| `TPP` | |
| `taxReviewed` | `true` \| `false` | |
| `stripeTaxCodeId` | e.g. `txcd_99999999` | material tax code |
| `stripeTaxCodeName` | e.g. "General - Tangible Goods" | **read-only, export-only** — resolved name of whatever `stripeTaxCodeId` currently is, for human readability while scanning/bulk-editing. Ignored on import. |
| `laborInstallTaxCodeId` | e.g. `txcd_20020010` | override; blank is valid (means "no override, use the derived default") |
| `laborInstallTaxCodeName` | | read-only, export-only, same purpose as above |
| `laborServiceTaxCodeId` | | override; blank is valid |
| `laborServiceTaxCodeName` | | read-only, export-only |

Add a second sheet, `Stripe Tax Code Reference`, listing at minimum the codes that actually show up in `CANONICAL_LABOR_TAX_DEFAULTS` plus `txcd_99999999` (General - Tangible Goods) and any others already in use anywhere in the catalog — `id | name | description` — so Ryan has something to copy/paste from without needing to remember 672 codes by heart. Don't attempt full Excel dropdown/data-validation against all 672 `StripeTaxCode` rows — not worth the complexity for a handful of codes that actually get used.

### Import semantics — read this carefully, this is where a bug would actually lose Ryan's work

- Match existing categories by `(domain name-or-slug, category name-or-slug)`, same normalization approach already used in `io.ts` (`nameMatchKey`/slug fallback). **Never create a new domain or category from this importer** — that's what the Part-2-of-`02` sectioned importer is for. If a row's domain+category doesn't match anything existing, it's **unresolved**: report it, skip it, don't guess.
- `taxProfile`: the DB column is `NOT NULL` with a default — there is no valid "clear it" state. A blank cell here means **leave the existing value untouched**, and warn. Only apply a change when the cell contains exactly `REAL_PROPERTY` or `TPP`.
- `taxReviewed`: blank means leave untouched + warn. Only `true`/`false` (case-insensitive) apply.
- `stripeTaxCodeId` / `laborInstallTaxCodeId` / `laborServiceTaxCodeId`: these ARE nullable override columns, so **a blank cell here means "set to null"** — that's a legitimate, common, intentional state (most categories won't have a labor override at all). This is safe specifically because the export always reflects live current state: Ryan exports fresh, edits some cells, re-imports, and every blank cell round-trips to whatever it already was (null → null is a no-op). **Call this out explicitly in the UI or the export's own instructions**: don't reuse an old downloaded file days later without re-exporting first, since it'll blank-out any override set in the meantime.
- If a non-blank `stripeTaxCodeId`/`laborInstallTaxCodeId`/`laborServiceTaxCodeId` value doesn't match a real seeded `StripeTaxCode.id`, treat it like the existing "never invent a code" discipline in `tax.ts`: flag the row, don't write anything for that field, leave the existing DB value alone.
- Two-phase preview-then-commit, same pattern as every other importer in this app. Admin-only commit. Never touch anything not present in the file (a category simply absent from the sheet is left alone entirely).

### Where this lives

Export/Import buttons directly on `/materials/categories`' own toolbar (not only reachable via the `/materials/import-export` hub).

## Part 2: item-level tax override columns (extend the existing sectioned exporter, don't build a new one)

Item-level tax overrides exist (`MaterialItem.taxProfile`/`stripeTaxCodeId`/`laborInstallTaxCodeId`/`laborServiceTaxCodeId`) but are rare — most items just inherit the category's classification. Rather than building a second flat item exporter, extend the **existing** sheet-per-domain sectioned format that `02` already built and tested:

- Extend `ITEM_HEADERS` from `description | unit | laborUnits | laborUnitNotes` to add `taxProfile | stripeTaxCodeId | laborInstallTaxCodeId | laborServiceTaxCodeId` (4 more optional columns, same blank-means-null semantics as Part 1's override columns — except item `taxProfile` IS nullable at the item level, unlike category, so blank there legitimately means "no override, inherit from category").
- Extend `ExportItem`/`PlannedItemCreate`/`PlannedItemUpdate`/`ExistingItem` types in `io.ts` to carry these four fields through `planImport`/`buildExportAoa` alongside the existing ones. Same change-detection pattern already used for `unit`/`laborUnits`/`laborUnitNotes`.
- Surface Export/Import for this directly on `/materials/items`' toolbar too (same underlying scope-by-division picker that already exists), not only the hub page.

## Part 3: attribute-assignment linkage export/import (new)

`MaterialAttributeAssignment` (category ↔ attribute, with `isRequired`/`isFilterable`/`isVariantDefining`/`defaultOptionId`/`sortOrder`) is real linkage data that has no bulk path at all right now — same one-at-a-time problem as tax data had. New flat sheet, `Attribute Assignments`, one row per (category, attribute) pair:

| Column | Notes |
|---|---|
| `domain` | |
| `category` | |
| `attribute` | `MaterialAttribute.name` (or slug — pick whichever `04`'s format already uses for consistency) |
| `isRequired` | `true`/`false` |
| `isFilterable` | `true`/`false` |
| `isVariantDefining` | `true`/`false` |
| `defaultOption` | the option's `label` (not its id — ids aren't human-editable); blank = no default |
| `sortOrder` | integer |

Import: match `(category, attribute)` — create the assignment if missing, update the flag/default/sort fields if present, **never delete an assignment missing from the file** (same non-destructive rule as everywhere else). Resolve `defaultOption` by matching `(attributeId, label)` normalized the same way `04`'s option matching works; if it doesn't resolve, flag the row and leave `defaultOptionId` untouched rather than guessing.

Surface this on `/materials/attributes`' toolbar (or wherever attribute-category assignment is currently managed) alongside the existing per-attribute-list export/import from `04`.

## Part 4: "export everything" from the main Materials dashboard

One workbook, one button on `/materials`, combining:
- `Domains` (flat: name, slug, sortOrder)
- `Categories` (Part 1's flat sheet, full contents)
- one sheet per division/segment scope using the existing sectioned item layout, now carrying Part 2's extra tax columns
- the existing attribute-lists sheets from `04` (index + one sheet per attribute)
- `Attribute Assignments` (Part 3's flat sheet)

This is **export-only** — a full audit/backup snapshot, not a single mega-import path. Import stays scoped per-section (Parts 1–3 and the existing `02`/`04` importers) so a bad edit in one section can't cascade into accidentally touching everything else in one commit.

## Non-goals

- No new pricing/cost fields (`baseCost`, `markupPct`, `wasteFactorPct`, `supplier`, `isConsumable`) in any of these sheets — not what was asked for, don't scope-creep into it.
- No Excel dropdown/data-validation against the full 672-row `StripeTaxCode` table — the small reference sheet in Part 1 is enough.
- Don't remove or restructure the existing `/materials/import-export` hub page — additive only.
- No changes to `resolveItemTaxClassification`/`resolveLaborTaxCode` logic — this prompt is purely about getting data in and out in bulk, not changing how it resolves.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- **Part 1, test the actual pain point**: export Categories, edit `taxProfile`/`taxReviewed`/one `stripeTaxCodeId` for ~10 rows in a copy of the file, re-import, confirm only those ~10 rows change and everything else is untouched.
- Confirm a blank `laborInstallTaxCodeId`/`laborServiceTaxCodeId` cell on import sets that field to null, and a row where it was already null round-trips with no reported change.
- Confirm an invalid/unseeded Stripe code id in a cell is flagged and doesn't get written.
- Confirm a domain+category combination that doesn't exist is reported as unresolved and doesn't create anything.
- Part 2: export the item catalog for one division/segment, confirm the 4 new tax columns appear and round-trip; confirm items with no override still resolve to the category default via `resolveItemTaxClassification` unchanged.
- Part 3: add one new attribute assignment row and edit one existing assignment's `isFilterable` in a copy of the exported file, re-import, confirm only those two rows change and no assignment gets deleted.
- Part 4: confirm the "export everything" download contains all five sheet groups and opens cleanly in Excel.
- Confirm Export/Import controls are reachable directly from each of `/materials/categories`, `/materials/items`, `/materials/attributes`, `/materials/domains`, `/materials` — not only from `/materials/import-export`.
- Update `AGENTS.md` / `.cursor/rules/` with the new flat Categories/Attribute-Assignment formats and the extended item tax columns.
