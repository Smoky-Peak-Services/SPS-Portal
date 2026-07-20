# Build prompt: flat materials import (the third legacy export)

The prior build had three export formats total, not two. `01`/`02`/`03` covered the sectioned catalog export (`catalog_IS_COM_*.xlsx`) and `04` covers the attribute-lists export. This is the third: an older, flatter "materials" export, one row per item, no sheet-per-domain sectioning.

Build this after `03` (the bug fix) is in — reuse its shape-validation discipline here too: if a sheet doesn't match, say so, don't guess.

## Reference fixture

`claude/prompts/samples/materials-2026-06-28.xlsx`. One sheet, `Materials`, columns: `category | scope | description | sku | unit | laborUnits | laborUnitNotes | tags`. The whole fixture, in full (9 rows, this is not a sample of a larger file — it's the complete thing):

| category | scope | description | sku | unit | laborUnits | tags |
|---|---|---|---|---|---|---|
| access_control_card_readers | IS_COM | Mullion/Slim Mount Card Reader | ACC-RDR-MUL-EA-SIS | EACH | 0.75 | manufacturer; vendor; access_control; plastics |
| access_control_card_readers | IS_COM | Standard Single Gang Card Reader | ACC-RDR-STD-EA-SIS | EACH | 0.75 | manufacturer; vendor; access_control; plastics |
| access_control_electrified_lock | IS_COM | Standard Electric Strike (Fail-Safe) | ACC-STK-FSA-EA-SIS | EACH | 1.5 | manufacturer; vendor; hardware_finish; access_control |
| access_control_electrified_lock | IS_COM | Standard Electric Strike (Fail-Secure) | ACC-STK-FSC-EA-SIS | EACH | 1.5 | manufacturer; vendor; hardware_finish; access_control |
| access_control_fire_rated_lock | IS_COM | Heavy Duty Electric Strike (Fail-Safe) | ACC-STK-HSA-EA-SIS | EACH | 2 | manufacturer; vendor; hardware_finish; access_control |
| access_control_fire_rated_lock | IS_COM | Heavy Duty Electric Strike (Fail-Secure) | ACC-STK-HSC-EA-SIS | EACH | 2 | manufacturer; vendor; hardware_finish; access_control |
| access_control_maglocks | IS_COM | 1200 lb Delayed Egress Electromagnetic Lock | ACC-MAG-1200DE-EA-SIS | EACH | 3.5 | manufacturer; vendor; hardware_finish; access_control |
| access_control_maglocks | IS_COM | 1200 lb Electromagnetic Lock | ACC-MAG-1200-EA-SIS | EACH | 2.5 | manufacturer; vendor; hardware_finish; access_control |
| access_control_maglocks | IS_COM | 600 lb Electromagnetic Lock | ACC-MAG-600-EA-SIS | EACH | 2.5 | manufacturer; vendor; hardware_finish; access_control |

(`laborUnitNotes` omitted from the table above for width, but it's populated on every row in the real file — carry it through same as the other importers.)

Three things about this format that are genuinely different from the sectioned one, each requiring a real decision, not a mechanical translation:

### 1. `scope` is a column here, not a filename

The sectioned importer (`03`) requires the user to pick one Division + Segment for the whole upload, because the file only contains one scope's worth of domains. This format carries `scope` (e.g. `IS_COM`) per row, so a single file could mix multiple scopes. Don't force a single scope picker in the UI for this importer — resolve each row's scope independently from its `scope` value using the existing `segmentFromAbbrev` / scope-code helpers in `src/features/materials/scope-code.ts`, and group rows by scope internally.

### 2. `category` is a flat code that doesn't safely split into domain + category

Values like `access_control_card_readers` look like `{domain}_{category}` glued together, but there's no reliable, general way to know where the domain part ends and the category part begins (is it `access_control` + `card_readers`, or `access` + `control_card_readers`? You can't tell from the string alone, and guessing wrong silently creates the wrong domain — which is the exact bug `03` just fixed for the sectioned format). Don't parse `category` by splitting on underscores and guessing.

Instead: try to resolve `category` against **existing `MaterialCategory` slugs already in that scope** (normalize underscores to match the app's slug convention — `slugify()` in `src/features/materials/slug.ts` produces hyphens, so compare on a normalized form that treats `_` and `-` as equivalent). If it matches an existing category, use it. If it doesn't match anything, don't invent a domain — surface it in the preview as **unresolved**, and require the user to explicitly map it to a domain + category (pick existing or name a new one) before those rows can be committed. This is slower than auto-creating, and that's the point — a wrong auto-created domain is exactly what `03` had to clean up.

### 3. `sku` and `tags` don't map onto the current schema as-is — flag both, don't guess

- **`sku`**: this is a real part number, but `01-materials-catalog.md` deliberately left SKU off `MaterialItem` — a catalog item is a generic spec, the specific part number is a quote-time detail (see that prompt's "Substitution and part numbers" section). This file predates that decision. Default: don't import `sku` anywhere. If Ryan wants these preserved for reference, the fallback is appending it into `notes` (e.g. `"Legacy SKU: ACC-RDR-MUL-EA-SIS"`) — flag this as an option in the preview UI, don't decide it silently either way.
- **`tags`**: this is the real thing connecting this file to the attribute-lists file from `04`. A category's `tags` here (e.g. `manufacturer; vendor; access_control; plastics`) and an attribute option's `tags` in the attribute-lists file (e.g. the `color` attribute's "Black" option is tagged `jacket_color; plastics; hardware_finish`) share a vocabulary. The real design intent, reconstructed from both files: a category is tagged with which attribute-groups apply to it, and each attribute option is tagged with which category-groups it's relevant to — at quote time, an attribute's usable options for a given category are whichever options' tags intersect the category's tags. That's a tag-intersection filter, and it's a different mechanism than `MaterialAttributeAssignment` (which is a strict per-pair category-to-attribute join with no per-option filtering). Building full tag-intersection support is a real schema decision (something like adding a `tags: String[]` to `MaterialCategory` and to `MaterialAttributeOption`), not something to bolt on as a side effect of an importer. For this pass: where a tag value matches an existing `MaterialAttribute.slug` exactly (in this fixture, that's `manufacturer` and `vendor` — both are real attribute slugs from `04`), create a `MaterialAttributeAssignment` for that category + attribute (reusing what's already built). Tag values that don't match any attribute slug (`access_control`, `plastics`, `hardware_finish` in this fixture — these are option-level groupings, not attribute names) don't correspond to anything buildable right now — report them in the preview as informational ("category also tagged: access_control, plastics — no matching attribute, not imported") and stop there. Flag the bigger tag-intersection feature back to Ryan as a follow-up decision rather than building it here.

## Import mechanics

Same two-phase preview-then-commit pattern as `02`/`03`/`04`. Concretely: write a parser that turns the flat rows into the same `ParsedWorkbook` shape already defined in `src/features/materials/io.ts` (`ParsedDomain` → `ParsedCategory` → `ParsedItem`) wherever `category` resolves successfully, then feed that straight into the existing `planImport` — don't duplicate the upsert/dedupe logic that's already there. Item identity, matching, and non-destructive upsert behavior (never delete/deactivate on import) are identical to `02`: match by `(categoryId, normalized name)`.

Export for this exact flat legacy shape is optional — the sectioned format from `02` is the go-forward canonical export. Don't build a second permanent export path for this one unless Ryan asks for it; getting old data in is the actual need here.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Import `claude/prompts/samples/materials-2026-06-28.xlsx` into the Integrated Systems Commercial scope, after `manufacturer` and `vendor` attributes already exist (import `04`'s fixture first, or seed them). Confirm the preview resolves all 4 category codes only if matching categories already exist in that scope (from `03`'s fixture, `access_control_card_readers` etc. won't match anything named that — this fixture's category codes don't match the sectioned catalog's actual category names like "Card  Reader" — so expect these 4 to come back **unresolved** unless you map them manually; that's correct behavior, not a bug).
- Map one unresolved category to an existing or new domain/category manually in the preview UI, confirm its rows become importable and the other 3 stay unresolved until mapped too.
- Confirm `sku` values never land in any database column unless the "preserve to notes" option was explicitly chosen.
- Confirm `manufacturer`/`vendor` tags produce real `MaterialAttributeAssignment` rows once a category is resolved, and confirm `access_control`/`plastics`/`hardware_finish` show up as informational-only, not silently dropped without a trace.
- Update `AGENTS.md` / `.cursor/rules/` once this is real.
