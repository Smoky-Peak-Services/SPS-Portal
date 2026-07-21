# Build prompt: consolidate nav into tabbed sections + fix UI table/width inconsistency

Ryan's goal: a lean nav (not a QuickBooks-style wall of items with deep nesting). Right now the Operations nav has six flat items (Dashboard, Materials, Labor rates, Complexity, Recurring fees, Catalog I/O). Collapse the feature items into **two** top-level sections, each with a thin horizontal sub-tab strip. No accordions, no third level of nesting — exactly one level of tabs inside a section.

Target nav (Operations section):
- **Dashboard** — unchanged.
- **Catalog** (was "Materials") — sub-tabs: Materials · Recurring Fees · Catalog I/O · Consumables *(disabled placeholder, see below)*.
- **Rates** (was "Labor rates"; absorbs Complexity) — sub-tabs: Labor Rates · Complexity Multipliers.

Everything below is one prompt; build it as a single coherent change.

## Current state (grounding — verified in the repo)

- Nav is data-driven from `src/config/nav.ts` (`navSections`), rendered by `src/components/layout/app-sidebar.tsx`.
- Routes today: `/materials` (hub) + drill-downs `/materials/{domains,categories,attributes,items,import-export}` (plus `[id]`/`new`); pricing at `/pricing/labor-rates`, `/pricing/complexity`, `/pricing/recurring`.
- Shared layout patterns exist but are used inconsistently: `src/components/patterns/{page-header,panel,data-table-shell,metric-card}.tsx`. Only `/materials` (hub) and `/` (dashboard) use `PageHeader`. The pricing pages and the materials list pages use ad-hoc headers (`<Link>` + `<h1>` + `<p>`), raw `<select>` filters, and hand-rolled `<table>`s.
- Capabilities gate nav items (`materials.access`, `pricing.access`, etc.) — preserve these.

## Part 1: nav.ts consolidation

Rewrite the Operations items in `navSections` to exactly three entries:
- Dashboard → `/` (`dashboard.access`), unchanged.
- **Catalog** → `/materials`, capability `materials.access`, icon something catalog-ish (e.g. `Package` / `LayoutGrid` — pick one and use it consistently).
- **Rates** → `/pricing/labor-rates`, capability `pricing.access`.

Remove the standalone `Complexity`, `Recurring fees`, and `Catalog I/O` nav items — they become sub-tabs, not nav entries. Keep the Admin section and footer as-is. Give Catalog and Rates distinct icons from each other so the two sections read differently (right now everything is `Package`).

Active-state note: the sidebar's active logic already uses `pathname.startsWith(item.href)` for non-root hrefs, so `Catalog` (`/materials`) stays highlighted across all `/materials/*` pages and `Rates` (`/pricing/labor-rates`) needs to stay highlighted across `/pricing/*`. Since `Rates` points at `/pricing/labor-rates` but should also light up on `/pricing/complexity`, either point the nav item at `/pricing` (with a redirect to `/pricing/labor-rates`) or broaden the active match to the section root. Prefer pointing the nav href at the section root and redirecting — see Part 3.

## Part 2: Catalog section — shared layout + sub-tabs

Move the recurring page under the catalog segment so all Catalog tabs share one layout:
- Move `src/app/(portal)/pricing/recurring/page.tsx` → `src/app/(portal)/materials/recurring/page.tsx`. The feature code stays in `src/features/pricing/` (route path ≠ feature dir); just move the route file and update its imports/links. **Keep its existing capability gate as-is** (`requireArea("pricing")`) so permissions don't silently change just because it moved visually under Catalog — note this in a comment; if Ryan wants it re-gated to materials later that's a conscious call, not a side effect here.

Add `src/app/(portal)/materials/layout.tsx` that renders the Catalog `SectionTabs` (Part 4) above `{children}`. Tabs:
- **Materials** → `/materials`
- **Recurring Fees** → `/materials/recurring`
- **Catalog I/O** → `/materials/import-export`
- **Consumables** → disabled placeholder (Part 5)

This layout wraps every `/materials/*` page, so the drill-down pages (`/materials/categories`, `/materials/items/[id]`, etc.) also show the Catalog tab strip with **Materials** active — that's the intended consistent section chrome, don't special-case them out. The materials drill-down routes do **not** move; only `recurring` moves in.

Active-tab matching: **Materials** is active for `/materials` and any `/materials/*` that isn't `recurring` or `import-export`; **Recurring Fees** active on `/materials/recurring`; **Catalog I/O** active on `/materials/import-export`. Implement with longest-prefix matching so `/materials/import-export` doesn't also light up the Materials tab.

## Part 3: Rates section — shared layout + sub-tabs

`/pricing` now holds just two pages (recurring left in Part 2). 
- Add `src/app/(portal)/pricing/layout.tsx` rendering the Rates `SectionTabs`: **Labor Rates** → `/pricing/labor-rates`, **Complexity Multipliers** → `/pricing/complexity`.
- Add `src/app/(portal)/pricing/page.tsx` that redirects to `/pricing/labor-rates`, so the nav item can point at `/pricing` and the section root resolves cleanly.
- Point the `Rates` nav href at `/pricing`.

## Part 4: shared `SectionTabs` component

One reusable client component (`src/components/patterns/section-tabs.tsx`) used by both section layouts — do not hand-roll the tab strip twice.
- Props: an array of `{ label, href, disabled? }`.
- Client component (`"use client"`) using `usePathname()` for active state via longest-matching-prefix.
- Style it as a single horizontal underline/pill tab row consistent with the reference dark UI: a thin row, active tab uses the chrome primary (blue) accent from the theme tokens (`text-primary` + an underline/`border-b-2 border-primary` or a filled pill), inactive tabs `text-muted-foreground` with hover. Reuse the existing shadcn `tabs.tsx` styling primitives if it's clean to do so, otherwise a simple `<nav>` of `<Link>`s — either is fine, but only one implementation. Disabled tabs render muted, non-interactive, with a small "Soon" hint, and are not links.
- Keep it flat: this is the only tab layer; no nested tabs inside a tab.

## Part 5: Consumables placeholder — DO NOT build the feature

Add **Consumables** only as a disabled tab in the Catalog `SectionTabs` (muted, "Soon", not clickable, no route). Do **not**:
- create a `/materials/consumables` route or page,
- add any Prisma model, migration, or feature code for consumables,
- add pricing/stocking logic.

Consumables are a future feature (priced + stocked materials that carry their own weight without quoting). This prompt only reserves the visual slot so the nav intent is legible. Building it is explicitly out of scope.

## Part 6: UI consistency pass (the "half page then full page" complaint)

The complaint: on a single screen one block sizes to content (a narrow card) while the table below goes full-bleed, and different pages wrap content at different widths. Fix by standardizing, not redesigning:

1. **One content container.** Inspect `src/components/portal-shell.tsx` (the main content wrapper). Ensure the portal `<main>` applies a single consistent max-width + horizontal padding + vertical rhythm for all pages (e.g. one `mx-auto w-full max-w-[NNNN]px px-6 py-6` container). Every section page then renders inside the same column — no page should stretch edge-to-edge while another is boxed. Pick the max-width from what the dashboard/materials hub already look right at and apply it everywhere.

2. **Every page uses `PageHeader`.** Replace the ad-hoc `<Link>+<h1>+<p>` headers on the pricing pages (`labor-rates`, `complexity`, `recurring`) and the materials list pages with the shared `PageHeader` pattern, so title/description/actions align identically page to page. The per-page "← Dashboard" back-link is redundant now that sections have tab strips — drop it.

3. **Every table sits in the same shell at the same width.** Wrap all data tables (pricing `labor-positions-table`, `complexity-multipliers-table`, `recurring-fees-table`, and the materials list tables) in `DataTableShell`/`Panel` so they share one card width and the same `overflow-x-auto` behavior. Remove one-off widths like `min-w-[960px]` on a single table when sibling tables don't have them — instead apply a consistent rule: the table fills the panel width (`w-full`), and only scrolls horizontally inside its own shell when columns overflow, so a wide table never changes the page's outer width relative to a narrow form above it.

4. **Filter controls consistency.** The raw `<select>`/`<form>` division+segment filter on the pricing pages should use the same input styling as the rest of the app (reuse the shared `input`/`label` primitives or the same classes used elsewhere) so it doesn't look like a different app. Don't rebuild it as a fancy component — just make it visually consistent.

5. Where a page stacks a small form (e.g. `LaborRateConfigForm`) above a wide table, put both in equal-width `Panel`s in a single column so the eye sees one consistent content width top to bottom — no more narrow-then-wide jump on scroll.

Keep this a styling/layout normalization. Don't change any data, server action, calculation, or validation behavior.

## Non-goals

- No consumables feature/model/route (Part 5).
- No changes to labor/complexity/recurring/materials business logic, engines, schemas, or seeds — layout and nav only.
- No new nav library or router change — reuse Next App Router segment layouts and the existing sidebar.
- No third level of nesting anywhere; sections have exactly one tab strip.
- Don't move the materials drill-down routes; only `recurring` relocates.

## Verification checklist

- `npm run typecheck`, `npm run lint` clean; `npm run build` on Ryan's machine (sandbox can't run it).
- Nav shows exactly three Operations items: Dashboard, Catalog, Rates — with distinct icons.
- Catalog tab strip appears on `/materials`, `/materials/recurring`, `/materials/import-export`, and the drill-down pages, with the correct tab active in each case (Catalog I/O does not also highlight Materials).
- Recurring page works at its new `/materials/recurring` path; old `/pricing/recurring` references are updated (grep for `pricing/recurring` → zero stale links).
- Rates tab strip appears on `/pricing/labor-rates` and `/pricing/complexity`; `/pricing` redirects to `/pricing/labor-rates`; Rates nav item stays highlighted on both.
- Consumables tab is visible but disabled/non-navigable; no `/materials/consumables` route, no consumables model exists (grep confirms).
- On every section page, the page header, panels, and tables share one content width — no block that's half-width above a full-bleed table. Visually confirm the labor-rates page (config form + positions table) reads as one consistent column.
- Capability gating unchanged: a user without `pricing.access` still can't see Rates; without `materials.access` still can't see Catalog.
- Update `AGENTS.md` / `.cursor/rules/` to describe the two tabbed sections, the `SectionTabs` pattern, the recurring route move, and the reserved (unbuilt) Consumables tab.
