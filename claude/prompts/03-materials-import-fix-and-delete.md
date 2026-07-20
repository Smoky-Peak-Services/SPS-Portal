# Build prompt: fix the import bug that created garbage domains, and add delete

Paste this whole file into Cursor. This is a bug fix plus a missing safety feature, not a new module — it patches `src/features/materials/io.ts`, `io-actions.ts`, and `actions.ts`, all already built from `claude/prompts/02-materials-import-export.md`.

## What happened

Ryan uploaded a file into the materials importer that wasn't a materials catalog export — a different workbook called `attribute-lists-2026-06-24.xlsx` (an export of attribute/option picklists from the prior build — see `claude/prompts/04-materials-attribute-list-import.md` for what that file actually is and how to support it properly). The importer didn't recognize the shape, but it didn't reject it either: it silently created a garbage `MaterialDomain` for every sheet name in that file (`Attribute Lists`, `attachment_type_pathways`, `box_length`, `color`, `length_feet`, `manufacturer`, `vendor` — 7 empty domains with nothing under them), because it never checks whether a sheet actually matched the catalog layout before treating its name as a domain to create. There is also no way to delete a domain, category, or item anywhere in the app — `src/features/materials/actions.ts` has a `deleteAssignment`, and nothing else — so once those 7 garbage domains landed, there was no way to remove them.

Root cause, traced through `src/features/materials/io.ts`: `parseWorkbookAoa` pushes a `ParsedDomain` for every worksheet name unconditionally (`domains.push({ name: domainName, sheet: domainName, categories: deduped })`), even when `categories` comes back empty because `parseDomainSheet` never found a single row shaped like the expected header (`isHeaderRow` checks for `cells[0]?.toLowerCase() === "description"`, which none of the attribute-lists sheets have — every row in every one of those sheets falls through to the `"Data row outside a category block; skipped"` warning branch instead). `planImport` then sees a domain with no existing match and queues it as a create, regardless of whether it has any categories in it. A workbook that matches nothing still "succeeds" and creates empty top-level domains named after whatever sheets happened to be in the file.

## Fix 1: don't create a domain from a sheet that matched nothing

In `parseWorkbookAoa` (or `parseDomainSheet`), track whether a sheet produced at least one category with the expected header shape. If a sheet's `categories` array comes back empty **and** every row in it was skipped for shape reasons (header row never found — as opposed to a legitimately empty category block, which requires the category-title-then-header pattern to have matched at least once), don't add it to `parsed.domains` at all. Instead add a sheet-level warning distinct from the existing row-level ones — something like `"Sheet '<name>' doesn't match the catalog layout (no category header row found) — entire sheet skipped"` — and surface sheet-level warnings more prominently in the preview UI than per-row ones, not buried in the same scrolling list.

If **every** sheet in the workbook gets skipped this way, the preview must show a clear top-level result like "This file doesn't look like a materials catalog export — 0 of N sheets matched the expected layout," not a preview that looks like a normal (if boring) 0-changes import. A wrong file should look obviously wrong, not quietly succeed at doing nothing (or, as happened here, quietly succeed at doing something bad).

## Fix 2: add delete, safe by default

Add to `src/features/materials/actions.ts` (or a new `delete-actions.ts` in the same folder, following the existing file-per-concern pattern like `io-actions.ts`):

- `deleteMaterialUnit(id)`, `deleteMaterialDomain(id)`, `deleteMaterialCategory(id)`, `deleteMaterialItem(id)` — each gated by `requireArea("materials")`, admin-only for domain/category/unit (matches the existing admin-only gate on `commitMaterialsImport`).
- Default behavior is a **safe delete**: refuse (with a clear error, not a silent no-op) if the row has anything under it — a domain with categories, a category with items, a unit with items referencing it. This is exactly what's needed to clean up the 7 garbage domains from the bad import: they're empty, so a safe delete removes them with nothing else to consider.
- Add a separate, explicitly-labeled **force delete** path for domains/categories (cascade — delete everything under them) gated the same way but requiring a second confirmation in the UI (e.g. typing the domain's name to confirm, not just an "Are you sure?" dialog) — this is for the case where bad data isn't empty, not the common case. Don't make this the default action anywhere in the UI; it should require a deliberate extra step to reach.
- Wire delete buttons into the existing list pages (`src/app/(portal)/materials/domains/page.tsx`, `categories/page.tsx`, `items/page.tsx`) and `revalidatePath` the same set of routes the import actions already do.

## Immediate fix for the current broken state

Cursor: once delete exists, the fix for Ryan's actual current data is just using it — find and delete the 7 empty domains created by the bad upload (`Attribute Lists`, `attachment_type_pathways`, `box_length`, `color`, `length_feet`, `manufacturer`, `vendor`, or whatever subset actually landed) via the new safe delete, which will work cleanly since they're empty. If any of them turn out to have picked up a stray category or item somehow, that's what force-delete is for — but based on the file shape, that shouldn't have happened.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Re-run the preview step against `claude/prompts/samples/attribute-lists-2026-06-24.xlsx` (already in the repo) targeting any scope. Confirm the preview now reports 0 domains created and a clear "file doesn't match the catalog layout" warning, not 7 domain creates.
- Confirm `claude/prompts/samples/catalog_IS_COM_2026-07-08.xlsx` still imports correctly after this change (this fix must not regress the working case — a sheet with real category/item content should still parse normally).
- Delete an empty domain via the new UI, confirm it's gone and nothing else was touched. Try to delete a domain that has categories under it with the safe delete and confirm it's refused with a clear message; then confirm force-delete removes it along with its categories/items.
- Update `AGENTS.md` / `.cursor/rules/` to mention delete now exists for the materials catalog, same as every prior phase.
