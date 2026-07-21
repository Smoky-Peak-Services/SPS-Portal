# Build prompt: Cabin Services shared scope + one accessible ScopeSelector everywhere

Three related fixes in one prompt: (1) Cabin Services needs a Residential (CS_RESI) scope that shares one dataset with STR, (2) the division/segment picker must be the same component everywhere it's used, driven by config not by seeded data, and (3) that picker's dropdowns must meet accessibility contrast standards. Right now the Item Catalog has a good scope picker while Labor Rates and Recurring Fees roll their own raw `<select>`s off DB seed data — which is why Recurring Fees wrongly offers "Cabin Services + COMMERCIAL" (Cabin Services does no commercial work) and why the open dropdown in Ryan's screenshot is unreadable.

## Grounding (verified in repo)

- Scope is defined in `src/config/company.ts` → `company.divisions[].segments`, and derived into codes by `src/features/materials/scope-code.ts` (`listScopeCodes()`, `scopeCodeFor()`, `segmentFromAbbrev()`). `Segment` enum = `COMMERCIAL | RESIDENTIAL | STR`.
- Current divisions: Integrated Systems (`IS`, segments commercial+residential), Cabin Services (`CS`, segment `str` only). Cabin Services has **no catalog or rate data yet** — so there is no data migration risk in defining its scope model now.
- The Item Catalog picker (good one) lives in `src/features/materials/components/materials-import-export-client.tsx` and reads from `company`/`scope-code.ts`. Labor Rates (`/pricing/labor-rates`) and Recurring Fees (`/pricing/recurring` → now `/materials/recurring` after prompt 12) build their own raw `<select>` filters from `listLaborRateScopes()` / DB configs — that's the inconsistency to kill.
- There is **no** `select.tsx` in `src/components/ui/` yet — the app uses native `<select>`, which is why option contrast can't be controlled and fails accessibility.

## Part 1: Cabin Services shared STR + Residential scope

Confirmed model (Ryan): Cabin Services has **one shared dataset** — one catalog and one set of labor/recurring rates. `CS_STR` and `CS_RESI` are both valid customer scope codes, but they resolve to the **same** underlying data. STR vs Residential is only a customer-type label; the items and pricing are identical either way. This is unlike Integrated Systems, where `COMMERCIAL` and `RESIDENTIAL` are genuinely separate datasets.

Represent this in `company.ts` scope config without duplicating data:
- Give each division an explicit scope definition. Cabin Services' **customer segments** are `STR` and `RESIDENTIAL` (so `CS_RESI` exists and appears in pickers). Its **storage** is a single canonical segment — use `STR` — that both customer segments read and write.
- Add a division-level flag/field, e.g. `sharedCatalog: true` (or `catalogStorageSegment: "STR"`), that marks Cabin Services as sharing one dataset across its customer segments. Integrated Systems is `sharedCatalog: false` (each segment independent, 1:1 storage).
- Add a resolver in `scope-code.ts` (or a small `scope.ts`): `resolveStorageScope(divisionSlug, customerSegment) → { divisionId, storageSegment, scopeCode, shared }`. For Cabin Services + either STR or RESIDENTIAL → `storageSegment = STR`, `shared = true`. For everyone else → identity (storageSegment = customerSegment, shared = false). **Every read/write for the catalog, labor rates, and recurring fees must go through the storage segment**, so editing Cabin Services items/rates under `CS_RESI` writes the same rows as `CS_STR`.
- Update `listScopeCodes()` so Cabin Services yields both `CS_STR` and `CS_RES`, each with its label, but both carrying the same `storageSegment`.

UI treatment for shared divisions: when Cabin Services is selected, the picker still offers both STR and Residential and shows the matching scope code (`CS_STR` / `CS_RES`), but display a clear inline note: **"Cabin Services uses one shared catalog and rate set — STR and Residential edit the same data."** So the shared behavior is visible, not a surprise.

(Flag for Ryan, don't block: an alternative is to show Cabin Services as a single "CS" scope entry instead of two segments that share. I've kept both codes visible since you said both should be valid and CS_RESI was "missing" — easy to collapse to one entry later if the dual display feels redundant.)

Do **not** touch Integrated Systems' behavior — it stays split.

## Part 2: one shared `ScopeSelector` component, config-driven

Build a single reusable client component `src/components/patterns/scope-selector.tsx` and use it **everywhere a division+segment scope is chosen**: Item Catalog (`/materials/import-export`), Labor Rates (`/pricing/labor-rates`), Complexity (`/pricing/complexity`), Recurring Fees (`/materials/recurring`). Replace each page's bespoke picker with this one.

- **Source of truth = `company.ts` scope config, NOT seeded DB rows.** The Recurring Fees bug (offering Cabin Services + COMMERCIAL) exists because it derives options from whatever configs happen to be seeded. The selector must instead show real divisions and, per division, only that division's valid **customer segments** (IS → Commercial, Residential; CS → STR, Residential). A scope that has no data yet should still be selectable and simply show an empty/"not seeded yet" state on the page — never hide valid scopes or invent invalid ones.
- Props roughly: `{ value: { divisionSlug, segment }, scopes, onChange }` (or, for the server-component pages, keep the URL-param pattern but render this component for the control). Preserve whatever load mechanism each page already uses (URL search params + navigation) — just unify the control.
- Show the resolved **scope code** (e.g. `IS_COM`, `CS_STR`) beside the dropdowns, like the Item Catalog already does.
- When the division changes, the segment options must update to that division's valid segments and the selection must snap to a valid one (don't leave a stale COMMERCIAL selected under Cabin Services).
- Render the shared-catalog note (Part 1) when the selected division is a shared one.

## Part 3: accessible dropdowns (fix contrast)

The native `<select>` option list in Ryan's screenshot fails contrast (pale-blue highlight with near-white text; greyed disabled option unreadable). Fix by moving these scope dropdowns off native `<select>` onto a themed, accessible listbox:
- Add a shadcn/Radix **Select** primitive at `src/components/ui/select.tsx` (Radix `@radix-ui/react-select`, styled to match the existing dark theme tokens). Radix renders a custom listbox we can fully theme, unlike native options.
- Style states to meet **WCAG 2.1 AA (≥ 4.5:1 text contrast)** in the dark theme: normal option text on the popover background, the highlighted/active option (use an accent background with foreground text that passes 4.5:1 — not pale-blue-on-white), and disabled options (must still be legible, ≥ 3:1, visibly muted but readable — not the current washed-out grey).
- Use this Select inside `ScopeSelector`. If any other raw scope `<select>` exists in these pages, replace it too. (Non-scope native selects elsewhere are out of scope for this pass.)
- Keyboard + screen-reader accessible (Radix gives this): focus ring visible, arrow-key navigation, proper labels tied to each control.

## Non-goals

- No customer, quote, or CRM entity — CS_STR vs CS_RESI as a *customer classification* is future work; this prompt only makes the scope codes valid and the pickers correct.
- Do not split Cabin Services into two datasets, and do not duplicate its rows across segments.
- No new divisions or segments beyond making CS_RESI valid.
- Don't change Integrated Systems' split behavior.
- Don't restyle unrelated native selects outside the scope pickers.
- No calculation/engine/schema-logic changes — this is scoping config, one shared component, and dropdown accessibility.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean; `npm run build` on Ryan's machine.
- Item Catalog, Labor Rates, Complexity, and Recurring Fees all render the **same** `ScopeSelector` component.
- Cabin Services now offers **both** STR and Residential; selecting Residential shows scope code `CS_RES`; both load/save the same Cabin Services data (edit an item/rate under CS_RESI, confirm it appears under CS_STR).
- Recurring Fees no longer offers "Cabin Services + COMMERCIAL" (or any invalid division/segment pair); segment options always match the selected division's valid segments.
- The shared-catalog note appears for Cabin Services and not for Integrated Systems.
- Open each scope dropdown: highlighted, normal, and disabled option text all pass WCAG AA contrast against their background (verify with a contrast checker or computed ratios ≥ 4.5:1 for normal/active text). No pale-on-pale states remain.
- Keyboard-only: can open, arrow through, and select a scope; focus is visible; each control has an accessible label.
- `resolveStorageScope` returns `storageSegment = STR, shared = true` for Cabin Services + Residential, and identity for Integrated Systems scopes.
- Update `AGENTS.md` / `.cursor/rules/` with the scope model (customer segments vs storage segment, shared-catalog divisions), the `ScopeSelector` pattern, and the new `ui/select.tsx` primitive.
