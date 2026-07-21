# Build prompt: attribute list import/export

This is the follow-on to `03-materials-import-fix-and-delete.md`. It's a separate, real feature — not the fix for the bad upload, the thing that would let Ryan stop needing to hand-blend spreadsheets in Excel at all. Build 03 first.

## What this replaces

Ryan's workflow right now, without this: export the catalog, manually merge in attribute/option data from a separate old file in Excel, re-upload. This spec makes attribute lists a first-class import/export target, same as the item catalog, so that manual blending step goes away.

## Reference fixture

`claude/prompts/samples/attribute-lists-2026-06-24.xlsx` — a real export from the prior build. Its shape:

- **One index sheet, `Attribute Lists`**, columns `list_key | list_name | filter_mode`. One row per attribute. In the sample: `attachment_type_pathways` (filter_mode `DOMAIN`), `box_length` (`NONE`), `color` (`FACET`), `length_feet` (`NONE`), `manufacturer` (`DOMAIN`), `vendor` (`DOMAIN`).
- **One sheet per `list_key`**, named exactly that key, columns `label | sort_order | tags | rfq_contact | rfq_email`. One row per option. E.g. the `color` sheet has rows like `("Black", 2, "jacket_color; plastics; hardware_finish", "", "")`.

Mapping onto the already-built schema (`MaterialAttribute`, `MaterialAttributeOption` — see `claude/prompts/01-materials-catalog.md`):

- `list_key` → `MaterialAttribute.slug` (already a clean machine key in this format — no normalization ambiguity like the item catalog's freeform descriptions had).
- `list_name` → `MaterialAttribute.name`.
- Every attribute in this file is a picklist, so `inputType` should import as `SELECT` — there's nothing in this format that distinguishes `SELECT` from `MULTISELECT` (that's an `AttributeAssignment`-level choice made later, per category, using the UI that's already built).
- Each option row: `label` → `MaterialAttributeOption.label`, `value` → `slugify(label)` (reuse `src/features/materials/slug.ts`), `sort_order` → `MaterialAttributeOption.sortOrder`.

## What doesn't map, and why that's fine for now

- **`filter_mode`** (`DOMAIN` / `NONE` / `FACET`) doesn't correspond to anything on `MaterialAttribute` — filtering behavior lives on `MaterialAttributeAssignment.isFilterable`, which is per-category, and this file has no category linkage at all. Don't invent a mapping for it. Import the attribute without it; if Ryan wants filter behavior carried over, that's a per-category decision made later in the existing assignment UI (`assignment-panel.tsx`), not something this import can resolve on its own.
- **`tags`** on each option (e.g. `"jacket_color; plastics; hardware_finish"`) is a real feature — it means "only show this option when the attribute is assigned to a category tagged one of these" — but there's no model for it yet. `MaterialAttributeAssignment` is attribute-to-category; there's nothing that scopes individual *options* to a subset of categories. Building that is a schema change (something like a tag on `MaterialAttributeAssignment` plus a matching tag on `MaterialAttributeOption`, or a join table), and it's a real design decision, not a mechanical import mapping. **Don't build it as a side effect of this import prompt.** Import the option without the tag filtering behavior, and flag this gap back to Ryan explicitly so he can decide whether it's worth the schema change later, rather than deciding unilaterally here.
- **`rfq_contact` / `rfq_email`** are vendor/RFQ fields. Vendor and RFQ are explicitly out of scope for the materials catalog (see `01-materials-catalog.md`'s non-goals). Ignore these columns entirely.

## Dedupe / upsert semantics

Same non-destructive pattern as the item catalog importer (`03`'s fix applies here too — don't create an attribute from a sheet that doesn't match the expected option-list shape):

- Match `MaterialAttribute` by `slug` (already stable — no whitespace-normalization matching needed the way item names required it).
- Match `MaterialAttributeOption` by `(attributeId, value)`.
- Create what's missing, update `label`/`sortOrder` on existing rows if changed, never delete/deactivate anything missing from the uploaded file — identical reasoning to the item catalog: a partial file (just new options added since the last export) has to be safe to upload on its own.
- Same two-phase preview-then-commit flow, same transaction-wrapped commit, same per-row/per-sheet warning reporting, same shape-mismatch rejection from `03`. Reuse the pattern in `src/features/materials/io.ts` structurally (a parallel `attribute-io.ts` makes more sense than overloading `io.ts`, since the row shape is completely different) rather than reinventing the preview/commit UX.

## Export

Inverse of import: one `Attribute Lists` index sheet (all attributes, `list_key | list_name | filter_mode` — leave `filter_mode` blank on export since nothing populates it on import either, unless a later pass adds real support for it), then one sheet per attribute with its options (`label | sort_order | tags | rfq_contact | rfq_email` — leave `tags`/`rfq_contact`/`rfq_email` blank for the same reason). This keeps the file round-trippable even though this pass doesn't act on every column in it.

## Where this lives

Same page as the item catalog import/export (`src/app/(portal)/materials/import-export/`) — a second tab or section, "Attribute lists," not a separate route. Same `requireArea("materials")` gate, same admin-only commit.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Import `claude/prompts/samples/attribute-lists-2026-06-24.xlsx` fresh. Confirm the preview shows exactly 6 new attributes (`Attribute Lists` itself is the index sheet, not an attribute) with these option counts: `attachment_type_pathways` 14, `box_length` 6, `color` 31, `length_feet` 14, `manufacturer` 59, `vendor` 10 — 134 options total. If your parser doesn't land on those numbers, it's wrong.
- Re-upload the same file unchanged. Preview must show 0 new/changed rows.
- Add a new option to one attribute's sheet in a copy of the fixture, re-upload. Only that one row shows as new.
- Export, re-import the export, confirm 0 changes (round-trip).
- Update `AGENTS.md` / `.cursor/rules/` with the new attribute-list import area.
