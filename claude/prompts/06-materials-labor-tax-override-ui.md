# Build prompt: expose labor tax code overrides in the admin UI

`05-materials-tax-code-linkage.md` built the full data model and resolver for labor tax codes: `MaterialCategory`/`MaterialItem` already have `laborInstallTaxCodeId` and `laborServiceTaxCodeId` columns (FKs to `StripeTaxCode`), and `resolveLaborTaxCode()` in `src/features/materials/tax.ts` already resolves item override → category override → the `(taxProfile, workContext)` default table, exactly as specified. That part is correct and doesn't need to change.

What never got built: a way to actually set those two override columns. They're missing from `schemas.ts` (the Zod category/item schemas only have `taxProfile` and `stripeTaxCodeId`), missing from the category/item Server Actions, and missing from `category-form.tsx` / `item-form.tsx`. The columns exist in Postgres and the resolver reads them, but nothing in the app can write them. This prompt closes that gap — no new schema, no resolver changes, just wiring the existing fields end to end.

## Why this matters now (real example, not hypothetical)

Take "Category Cabling" (Structured Cabling domain). Running CAT6 is definitionally installation labor — you don't repair the middle of a cable run, you add or replace a length of it, which is install-type work every time, regardless of whether the technician is on-site because of a quoted job or a service ticket. If that labor ever gets billed against a service ticket, `resolveLaborTaxCode` would currently fall through to the generic `(taxProfile, SERVICE)` default — a repair code — because no override exists for this category. That's wrong for this category specifically.

The fix isn't a new "this category is always install" flag. The override columns already do this: set `laborServiceTaxCodeId` on Category Cabling to the *same* install code that `laborInstallTaxCodeId` would resolve to by default. Then both work contexts land on the install code for this category, decided once by Ryan during review — never picked by whoever happens to be billing the ticket.

(Separately: Category Cabling isn't on Ryan's TPP exception list — software/licenses, patch cables, servers, workstations, hard drives — so bulk cable should probably review to `REAL_PROPERTY`, not the `TPP` it's currently sitting at. That's Ryan's call in the same review pass this prompt exposes; whichever way it lands determines whether the override value should be `txcd_20020010` or `txcd_20020018`.)

## What to build

1. **Schemas** (`schemas.ts`): add `laborInstallTaxCodeId` and `laborServiceTaxCodeId` to both the category and item schemas, same shape as the existing `stripeTaxCodeId` field (`z.string().max(64).optional().or(z.literal(""))`).
2. **Actions** (`actions.ts`): thread both fields through the existing category/item create/update Server Actions the same way `stripeTaxCodeId`/`taxProfile` already flow through — parse, write, `revalidatePath`.
3. **Forms** (`category-form.tsx`, `item-form.tsx`): add two more searchable Stripe tax code pickers — reuse the same combobox component built for the material `stripeTaxCode` field in `05`, don't build a second picker component. Label them clearly:
   - "Labor tax code override — install" / "Labor tax code override — service"
   - Help text: "Leave blank to use the default derived from tax profile + install/service context. Set both to the same code only if this category's labor is always one type of work regardless of which job or ticket it's billed on (e.g. running cable is always installation labor)."
4. **List view visibility**: show a small indicator on the categories/items list (not a whole new review workflow like `taxReviewed`) when either override is set, so Ryan can see at a glance which rows have one — these should stay rare, and invisible overrides are exactly the kind of silent state this project's guardrails exist to avoid.

## Non-goals

- No changes to `resolveLaborTaxCode`'s resolution order — it's already correct (item → category → default).
- No new `WorkContext`-forcing enum or column. The existing per-context override fields already solve this; don't add a second mechanism that does the same thing a different way.
- No job/ticket UI, no bulk-setting of overrides across categories.
- No automatic re-deriving of an override if `taxProfile` changes later — an override is a deliberate value Ryan set, same trust model as `taxProfile` itself; if the underlying classification changes, revisiting the override is a manual step, not something to auto-correct.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Set Category Cabling's `laborServiceTaxCodeId` through the new form field to match its (eventual, reviewed) install code; confirm it persists and shows on the list indicator.
- Call `resolveLaborTaxCode` for that category under both `INSTALL` and `SERVICE` `workContext`, confirm both now return the same code.
- Confirm a category with no override set still falls through to the `(taxProfile, workContext)` default table unchanged (no regression to `05`'s behavior).
- Update `AGENTS.md` / `.cursor/rules/` to note the labor tax override fields are now settable, same as every prior phase.
