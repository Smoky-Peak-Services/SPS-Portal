# Build prompt: active-scope catalog switcher + scope-filter every materials query

## Framing (read first)

The three catalogs (IS Commercial, IS Residential, Cabin Services) are **foundational scoped datasets** — they feed roughly 75% of everything downstream: service tickets, SMA contracts, estimates, and jobs. So this pass is about making the scoping **correct, consistent, and stable enough to be referenced by those future consumers** — not about changing the data model.

**Optimize, do not rewrite.** Keep the existing schema as-is: the material EAV (domain → category → attribute → option → assignment → item → value), the per-scope labor/complexity/recurring/plan models, everything. Do not flatten the attribute system, do not collapse tables, do not "simplify" the model. The only problems being fixed here are (a) there's no catalog switcher and (b) the queries ignore scope. This is a UI + query-scoping + consistency pass.

## The problem, stated plainly

The Materials catalog pages have **no way to switch which catalog you're viewing**, and the queries behind them ignore scope entirely. Verified in `src/features/materials/actions.ts`: `listMaterialCounts`, `listDomains`, `listCategories`, and `listItems` count/return **all rows globally** with no `divisionId`/`segment` filter (only `listAttributes` takes an optional scope). So the hub always shows the one populated catalog (IS-Commercial: 5 domains / 115 categories / 102 items) and there is no switcher anywhere on the browsing UI. That's the bug.

## The established pattern (this is not a guess)

This is the **price-book / regional-catalogue context** pattern, used across ERPs:
- **OpenConstructionERP** (the repo Ryan linked): one catalog taxonomy with multiple **regional price sets**; you pick a region/classification as the working context and every cost/catalog view filters to it ("regional pricing — automatic adjustment based on project location, compare rates across regions").
- **Salesforce**: Price Books — you select the active price book and product/pricing views scope to it.
- **Odoo**: pricelists / multi-company — an active context that filters catalog and pricing.

The shared idea: a **single active-scope selector** at the top of the workspace; everything below reflects it. We already built the `ScopeSelector` component (prompt 13) and the three-scope model (prompt 14). This prompt makes that selector the persistent active context for the whole Catalog + Rates area and actually filters the data by it.

## The three catalogs to switch between

1. Integrated Systems — Commercial (`integrated-systems` / `COMMERCIAL`)
2. Integrated Systems — Residential (`integrated-systems` / `RESIDENTIAL`)
3. Cabin Services (`cabin-services` / `STR`) — **one single catalog**, shown as one entry (no STR/Residential split; per prompt 14). Cabin's one catalog serves all its customer types.

## Part 1: a persistent "active scope" context

Introduce one active-scope context shared across the Catalog section (Materials, Recurring Fees, Catalog I/O) and the Rates section (Labor Rates, Complexity). Behavior:
- The `ScopeSelector` renders prominently at the **top of the content area** on every one of those pages (below the section tab strip from prompt 12). A dropdown, not a second row of tabs — the section already has a tab strip, and a second tab row for catalogs would be confusing. (Ryan said "tabs or a dropdown"; the dropdown is the right call given the existing tabs.)
- **Persist the selection** so switching pages keeps the same active scope — write it to a cookie (e.g. `active-scope=integrated-systems:COMMERCIAL`) read by the server components. A URL search param (`?divisionId=…&segment=…`) overrides the cookie when present (so links/bookmarks to a specific scope work), and selecting a new scope updates both the cookie and the URL.
- Default when nothing is set: the first populated scope (IS-Commercial today).
- The selector shows exactly the three catalogs above; Cabin is one entry.

Add a small server helper `getActiveScope(searchParams)` (reads URL param → cookie → default) returning `{ divisionId, segment }`, and a client action to set the cookie + navigate on change. Reuse the existing `ScopeSelector`; don't build a second selector.

**Make `getActiveScope` / the scope key the single canonical scope resolver for the whole app.** Service tickets, SMA contracts, estimates, and jobs will all need to resolve "which catalog/rate set applies" the same way. So this helper and the `{ divisionId, segment }` key must be the one reusable primitive they call later — not a materials-only thing. Put it somewhere shared (e.g. `src/lib/scope.ts` or `src/features/scope/`), not buried in materials. Don't build those consumers now; just make the seam clean so they plug in without reinventing scope resolution.

## Part 2: scope-filter every materials query (the actual fix)

Thread the active scope into all materials reads so the pages show only the selected catalog. In `src/features/materials/actions.ts`:
- `listMaterialCounts(scope)` → count domains/categories/items/attributes **within that `(divisionId, segment)`** (categories/items filtered via their domain's scope; attributes already carry scope from prompt 14; units are global — keep the units count global or drop it from the per-scope card, your call, but note it).
- `listDomains(scope)`, `listCategories(scope, domainId?)`, `listItems(scope, categoryId?)`, `listAttributes(scope)` → all filtered to the active scope. Categories/items filter by joining through `MaterialDomain.divisionId`/`segment`.
- The detail pages (`domains/[id]`, `categories/[id]`, `items/[id]`, `attributes/[id]`) should verify the record belongs to the active scope (or just load by id and display its scope) — don't let a category from IS-Commercial render while the switcher says Cabin. Simplest: when loading a detail record, set the active scope to that record's scope so the breadcrumb/switcher stays truthful.
- "Create new" actions (new domain/category/attribute/item) must default the new record's `divisionId`/`segment` to the **active scope**, so you can't accidentally create an IS-Residential category while viewing Cabin.

Wire the pages (`materials/page.tsx` hub + the four list pages + recurring + catalog I/O + labor-rates + complexity) to read `getActiveScope()` and pass it down. The Catalog I/O page and pricing pages already pick a scope — converge them onto this same active-scope context so a user picks the catalog once and it holds across all of it.

## Part 3: per-scope empty states

IS-Residential and Cabin Services catalogs are currently empty. When the active scope has no domains/categories/items, show a clear empty state ("No materials in the Integrated Systems — Residential catalog yet. Import a catalog file or add a domain to start.") with the import and "new domain" actions — not a blank page and not the other scope's data.

## Non-goals

- **No data-model changes.** Keep the EAV attribute system and all per-scope models exactly as they are — this is a switcher + query-scoping + UI-consistency pass, not a schema refactor. If a change seems to require touching the schema beyond reads, stop and flag it.
- No new scope model — use prompt 14's three scopes as-is; Cabin stays a single scope.
- Don't reintroduce Cabin STR/Residential split.
- No cross-scope views or "all catalogs at once" merged list (that's what's broken now); a future "compare scopes" view is out of scope.
- No changes to import/export logic beyond having it respect the active scope as its default selection.
- Don't build a second selector component or a second tab row.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean; `npm run build` on Ryan's machine.
- The Materials hub, all four list pages, Recurring Fees, Catalog I/O, Labor Rates, and Complexity all show the same active-scope `ScopeSelector` at the top, and it's the same selection across all of them (switch on one page → still selected on the next).
- Selecting Integrated Systems — Commercial shows 5 domains / 115 categories / 102 items; selecting Integrated Systems — Residential or Cabin Services shows that scope's data (empty state today), **never** IS-Commercial's rows.
- Counts on the hub cards reflect the active scope only.
- The selection persists across navigation (cookie) and via a shareable URL param; a fresh session defaults to the first populated scope.
- Creating a new domain/category/attribute/item while a given scope is active stamps that scope on the new record.
- Cabin Services appears as exactly one catalog entry.
- Update `AGENTS.md` / `.cursor/rules/` to document the active-scope context pattern (cookie + URL), that all materials queries are scope-filtered, and that the same active scope drives the Catalog and Rates sections.
