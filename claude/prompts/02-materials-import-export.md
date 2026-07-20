# Build prompt: materials import/export

Paste this whole file into Cursor (or `@`-mention it) as the task brief. It builds on the materials catalog from `claude/prompts/01-materials-catalog.md`, which is already built (`MaterialUnit`, `MaterialDomain`, `MaterialCategory`, `MaterialAttribute`/`MaterialAttributeOption`/`MaterialAttributeAssignment`, `MaterialItem`, `MaterialItemAttributeValue` all exist in `prisma/schema.prisma`, with CRUD under `src/features/materials/` and `src/app/(portal)/materials/`).

## Read first

- `AGENTS.md` — engineering handbook, especially §4/§8 for the `features/<domain>/` convention this should follow.
- `src/features/materials/schemas.ts`, `slug.ts`, `tax.ts` — existing helpers to reuse, not reinvent.
- This file end to end before writing code. The dedupe behavior described here is the actual point of the task, not a footnote.

## Why this is non-negotiable

Ryan built and used a version of this catalog import/export before, on the prior SPS Portal build. It worked a specific way that made it usable in practice: he could export the current catalog, add new rows to that same spreadsheet in Excel, and re-upload the whole file — and it would merge in only what was new, without duplicating what already existed, and without him having to hand-diff the file or wipe the catalog and start over first. That round-trip is the feature. An import that only accepts a diff, or that requires clearing existing data first, does not meet the bar — match the behavior described here exactly.

## Reference fixture

`claude/prompts/samples/catalog_IS_COM_2026-07-08.xlsx` is a real export from the prior build, for the Integrated Systems Commercial scope. Use it as the actual test fixture, not a hypothetical. Its exact shape, decoded:

- **Workbook = one division + segment scope.** The filename encodes it: `catalog_{SCOPE_CODE}_{YYYY-MM-DD}.xlsx`. In this file, `IS_COM` means Integrated Systems, Commercial segment. Don't hardcode a scope-code table separately from `src/config/company.ts` — derive it (e.g. division slug initials + segment) so it can't drift out of sync with the actual division list.
- **One sheet per domain.** This file has 5 sheets: `Access Control`, `Alarm Systems`, `Video Surveillance`, `Structured Cabling`, `AV Systems`. Sheet name = `MaterialDomain.name`.
- **Within a sheet, repeating blocks, one per category:**
  1. A row with just the category name in column A, columns B–D blank (e.g. `("Card  Reader", None, None, None)`).
  2. A literal header row: `description | unit | laborUnits | laborUnitNotes` — these are the exact `MaterialItem` field names, not friendly labels. Match them literally.
  3. Zero or more data rows: `description` (→ `MaterialItem.name`), `unit` (→ `MaterialUnit.code`), `laborUnits` (→ decimal, stored as text in the source file, e.g. `"0.33"`, `"0.0002"` — parse defensively), `laborUnitNotes` (→ `MaterialItem.laborUnitNotes`).
  4. A blank row (all four cells empty) separates one category block from the next — except when a category is the last thing in the sheet, in which case there's no trailing blank row. Some categories in this file have a header and zero data rows (e.g. every category in `Alarm Systems`, `Video Surveillance`, `Structured Cabling`, `AV Systems` — structure exists, items don't yet). That's valid, not an error: create the empty category and move on.

Ground truth for this fixture, to test against directly: 5 domains, 115 categories total, 102 items total — every single item is in the `Access Control` sheet (22 categories, 102 items); the other four sheets are 26 + 28 + 28 + 11 = 93 categories with zero items. If your parser doesn't land on those numbers, it's wrong.

Real messiness already present in this exact file that the parser has to handle, not paper over: `"Card  Reader"` (double space), `"Miscellaneous Materials "` (trailing space), `"3/4" Recessed Door Contact - Screw Terminals "` (trailing space on a description). Normalize before matching (trim, collapse internal whitespace) or a re-upload will create near-duplicate categories/items that differ only by whitespace.

## Scope resolution

The import UI must let the user pick the target Division + Segment explicitly (a dropdown, sourced from `company.divisions` / the `Division` table + `Segment` enum) — don't trust the filename as the sole source of truth, just use it to pre-fill a guess if it parses cleanly against the derived scope-code table. Every domain in the uploaded workbook gets scoped to whatever Division + Segment the user confirmed for that import.

## Dedupe / upsert semantics — the core requirement

Matching key, at every level, using the **trimmed, whitespace-collapsed** name (case-insensitive compare for matching; store the cleaned value, not the raw messy one):

- Domain: `(divisionId, segment, normalized name)`
- Category: `(domainId, normalized name)`
- Item: `(categoryId, normalized name)`

Behavior on import, for every row in every sheet:

1. If the domain (by that key) doesn't exist yet, create it. Same for category, same for unit code.
2. If the item (by `categoryId` + normalized name) doesn't exist, create it.
3. If it does exist, update it if `unit`, `laborUnits`, or `laborUnitNotes` differ from what's stored — otherwise leave it untouched.
4. **Never delete or deactivate an existing item, category, or domain just because it's missing from the uploaded file.** A partial file (say, just the new rows someone added since the last export) must be safe to upload on its own — this is what makes "just add the new stuff and re-upload" work instead of forcing a full replace. If a full-sync "remove anything not in this file" mode is ever wanted, that's a separate, explicitly-opt-in, clearly-labeled danger button — do not build it as part of this pass, and do not make it the default under any circumstance.

Add a real database constraint backing this, don't rely on application logic alone: migrate `MaterialItem` to add `@@unique([categoryId, name])` (and equivalent uniqueness is already implied for `MaterialDomain`/`MaterialCategory` via their existing `@@unique` on slug — reuse the existing slugify helper in `slug.ts` to derive a normalized slug for matching instead of inventing a second normalization scheme).

## Two-phase flow: preview, then commit

Parsing and writing in one step is exactly how you'd accidentally import garbage into a real pricing catalog. Split it:

1. **Preview (no writes).** Parse the whole workbook, resolve every row against current DB state, and return a structured report: how many domains/categories/units/items will be newly created, how many existing items will be updated (and what field changed, old value → new value), and a list of row-level problems (sheet name + row number + what's wrong) — e.g. a data row with a description but no parseable `laborUnits`, or a unit code that's blank. Problems don't have to block the whole import (default a missing `laborUnits` to `0` and flag it as a warning, for instance) but they must be visible before commit, not discovered after.
2. **Commit.** Only after the user reviews the preview and confirms, actually write — inside a single Prisma `$transaction`, so a failure partway through doesn't leave the catalog half-imported.

## Export

Given a Division + Segment, generate the exact inverse of the import format: one sheet per `MaterialDomain` (ordered by `sortOrder`), each sheet containing one block per `MaterialCategory` (ordered by `sortOrder`) with the literal `description | unit | laborUnits | laborUnitNotes` header row, its items (ordered by `sortOrder` then name), and a blank separator row between categories. Filename: `catalog_{SCOPE_CODE}_{YYYY-MM-DD}.xlsx`, same scope-code derivation as import, today's date. This is what makes the round-trip real — export, hand-edit or add rows in Excel, re-upload the same file, nothing duplicates.

## Implementation notes

- Add `exceljs` as a dependency (`npm install exceljs`) for both reading the uploaded workbook and writing the export — nothing for xlsx exists in this repo yet.
- Import: a Server Action that accepts `FormData` with the uploaded file (Next.js Server Actions support `File` fields directly), split into a `previewMaterialsImport` action (parses, returns the report, writes nothing) and a `commitMaterialsImport` action (re-parses — don't trust client-echoed state for something this consequential — and writes in a transaction).
- Export: a route handler (`src/app/api/materials/export/route.ts` or similar) that streams back the generated `.xlsx` with the right filename and content-disposition header, since Server Actions aren't the right fit for a file download.
- New page under `src/app/(portal)/materials/` (e.g. `import-export/`) with the scope picker, file upload, preview report display, and confirm button, plus export links per scope. Follow the same `requireArea("materials")` gate as the rest of `src/app/(portal)/materials/`. Consider gating the commit step (not just the page) to `admin` only, since a bad commit can bulk-modify real pricing data — Ryan's call, flag it rather than deciding unilaterally.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean. Run the new migration (`npm run db:migrate`).
- Import `claude/prompts/samples/catalog_IS_COM_2026-07-08.xlsx` fresh into an empty scope. Confirm the preview reports 5 new domains, 115 new categories, and however many new units the file's `unit` values resolve to, and 102 new items — commit, then confirm the DB matches those numbers exactly.
- Re-upload the exact same file with zero changes. The preview must report 0 new domains/categories/items and 0 updates — proving the dedupe actually works, not just that it doesn't crash.
- Duplicate the fixture, add 2–3 new item rows to the `Access Control` sheet (reuse an existing category), re-upload. Preview must show only those new rows as new, everything else as unchanged, and existing categories/domains untouched.
- Edit one existing row's `laborUnits` in a copy of the fixture, re-upload. Preview must show that one item as an update with the old and new value, everything else unchanged.
- Export the scope you just built, and confirm the exported file, re-imported, produces zero new/changed rows (true round-trip).
- Update `AGENTS.md` and `.cursor/rules/` with the new import/export area once this is real, same as every prior phase.
