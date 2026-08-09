# Prompt 26 — Hygiene: authz gaps, timezone handling, test runner, dead code

Low-risk cleanup. None of this is urgent on its own, but items 1 and 2 produce user-visible wrong behavior and item 3 means part of the test suite silently never runs. Read `AGENTS.md` §3, §6, §7, §8, §10, §11.

---

## 1. Six `/materials` pages are missing `requireArea("materials")`

These call only `requireDesktopSurface(...)`:

- `src/app/(portal)/materials/domains/new/page.tsx:15`
- `src/app/(portal)/materials/categories/new/page.tsx:15`
- `src/app/(portal)/materials/items/new/page.tsx:24`
- `src/app/(portal)/materials/domains/[id]/page.tsx:22`
- `src/app/(portal)/materials/categories/[id]/page.tsx:25`
- `src/app/(portal)/materials/items/[id]/page.tsx:25`

`src/app/(portal)/materials/layout.tsx:20` calls only `requireUser()`. Peers like `attributes/new/page.tsx:17` do call `requireArea("materials")`.

Consequence: a signed-in `field_tech` hitting `/materials/items/new` is not redirected. The data actions then throw `Error("You do not have permission for this action")` from `requireMaterialsAccess()` (`src/features/materials/authz.ts:9`), so the user gets a **500 error page** instead of the §6 redirect. No data leaks — every read in `materials/actions.ts:66-246` is guarded — but the failure mode is a crash.

**Fix:** promote the guard into `materials/layout.tsx` (`await requireArea("materials")`), and remove the now-redundant per-page calls only where the page has no *additional* capability requirement.

Same pattern, no exposure today but do it while you're here: `clients/[id]/estimates/page.tsx`, `invoices/page.tsx`, `service-tickets/page.tsx` carry no guard of their own. They inherit `clients/[id]/layout.tsx:27-28` and render only static `EmptyState` copy, so add `await requireArea("crm")` when they become data-backed.

---

## 2. `dashboard.access` is gated in nav but never enforced

`src/config/nav.ts:30` gates `/` on `dashboard.access`; `src/app/(portal)/page.tsx:13` calls only `requireUser()`. Revoking the capability hides the sidebar link, but the page renders fine on direct navigation — the capability is decorative.

Compounding it: `defaultRouteForRole()` (`src/config/permissions.ts:139-141`) returns `"/"` for **every** role, so every `requireArea` failure anywhere redirects to the one unguarded page.

Every other nav capability does match its page — `crm.access` ↔ `requireArea("crm")` on `/leads`, `/call-log`, `/clients`; `materials.access` ↔ `/materials`; `pricing.access` ↔ `/pricing/*`; both `settings.*.manage` match their `requireCapability` calls. Only `/` is wrong.

**Fix:** pick one — either enforce `requireArea("dashboard")` on `/` and give `defaultRouteForRole` a non-`/` fallback per role, or drop `dashboard.access` from `CAPABILITIES` and `nav.ts` because it cannot be enforced. Prefer the second unless Ryan wants a role that can't see the dashboard.

---

## 3. There is no `npm test`, and one test file is never run

`package.json:11-40` defines 17 individual `test:*` scripts and **no** aggregate `test`. `src/features/materials/validation.test.ts` (3 tests covering `assertItemAttributeValues`, which gates every item write at `materials/actions.ts:656,697`) is referenced by no script and therefore never executes.

**Fix:** add `"test": "tsx --test 'src/**/*.test.ts'"` and reduce the per-file scripts to thin aliases. Update `AGENTS.md` §10.

---

## 4. Timezone: Luxon is used in 2 files; every user-visible timestamp bypasses it

§3 and §8 require all dates through Luxon localized to `company.timezone`. Actual Luxon use: `clients/[id]/layout.tsx:3` and `cron/purge-run.ts:17`. Violations:

- `src/app/(portal)/page.tsx:24` — `new Date().getHours()` picks the greeting from the **server's** clock (UTC on Vercel): "Good evening" at 2pm Eastern.
- `src/app/(portal)/leads/[id]/page.tsx:133` and `src/app/(portal)/clients/archive/page.tsx:65` — `toLocaleString()` / `toLocaleDateString()` in server components render in the server's UTC locale.
- `src/features/crm/components/activity-panel.tsx:95` and `src/features/phone/components/call-log-client.tsx:50` — same calls inside `"use client"` components, which are also SSR'd. The server emits UTC, the browser re-renders local → a **React hydration mismatch on every activity feed and call-log row**.
- `todayStamp()` is duplicated verbatim in four export routes (`api/materials/export-everything/route.ts:22-28`, `categories/tax-export/route.ts:13-19`, `domains/export/route.ts:11-17`, `attributes/assignments-export/route.ts:14-20`) plus a fifth variant at `features/materials/scope-code.ts:69`, all using `new Date()` — so evening-Eastern exports carry tomorrow's date in the filename.

**Fix:** one `formatInCompanyTz(date, format)` helper in `src/lib/` using `DateTime.fromJSDate(d).setZone(company.timezone)`, plus one shared `todayStampInCompanyTz()`. Apply at all sites above. For the client components, pass a pre-formatted string down from the server so there is nothing to mismatch.

---

## 5. `server-only` guard is on 1 of the 3 secret-reading lib files

`src/lib/geoapify.ts:1` has `import "server-only"`. But:

- `src/lib/quo-api.ts` reads `OPENPHONE_API_KEY` / `OP_API_KEY` (`:16-17`) and only *says* "server-only" in a comment (`:2`).
- `src/lib/openphone.ts` reads `OP_WEBHOOK_SECRET` / `OPENPHONE_WEBHOOK_SECRET` (`:30-31`), has no guard, **and** re-exports `parseUsPhone` / `toE164` / `phoneNational` (`:4-11`) — exactly the helpers a client form would reach for.

No current violation exists (verified: no client file imports either module), so this is a latent trap. One `import { toE164 } from "@/lib/openphone"` in a `"use client"` file would pull a secret-reading module into the browser graph with no build error.

**Fix:** add `import "server-only"` to `quo-api.ts` and `openphone.ts`, and point client code at `@/lib/phone-parse`.

---

## 6. The ops/PII schema guard is a 9-name denylist, not a rule

`src/features/accounting/ops-pii-schema-guard.test.ts:10-20` checks only `displayName`, `generalEmail`, `mainPhone`, `hqLine1`, `billingEmail`, `billingPhone`, `billingLine1`, `directEmail`, `directPhone`.

AGENTS.md §5 and §11 claim "never add a PII-identity column to ops" is *mechanically enforced*. Adding `customerEmail`, `siteAddress`, `contactPhone` or `homeLine1` to `prisma/schema.prisma` passes cleanly. The stated invariant is much broader than the check — and this matters a lot more once quote/work-order models land in ops and someone reaches for a "bill to" field.

**Fix:** switch to a pattern denylist, e.g. `/^\s*\w*(email|phone|line1|line2|postal|address|displayName)\w*\s+String/i`, with an explicit allowlist for the auth-owned `User.email` / `User.name`. Keep the existing positive assertions (`model Job {` / `model Ticket {` / `model TimeEntry {` absent).

---

## 7. Dead code

Safe to delete:

- `src/features/crm/actions.ts:572` `updateServiceLocation` — zero callers (`locations-panel.tsx` imports only `createServiceLocation` and `deleteServiceLocation`). Next.js still mints an action ID and registers an RPC endpoint for it. Either delete it or wire the location-edit UI it was written for — **ask Ryan which**, since editing a service location is obviously wanted eventually.
- `src/features/materials/delete-actions.ts:56` `deleteMaterialUnit` — zero callers. Same situation.
- `src/components/layout/app-header.tsx:10` `AppHeader` — zero references, though §4 lists it as live portal chrome.
- `src/components/portal-sidebar.tsx` — `@deprecated` re-export alias, zero references.
- `src/components/patterns/status-badge.tsx:19` `StatusBadge` — zero references, though §4 lists it among the patterns to use before inventing new chrome. **Keep this one** — quoting will want it. Just correct §4 if you'd rather.
- `src/config/nav.ts:143-144` `filterNavForRole` (`@deprecated`) and `src/lib/prisma-pii.ts:32-35` `isPiiDatabaseSplit` (`@deprecated`) — both dead, delete.
- Unused shadcn primitives `ui/avatar.tsx`, `ui/dropdown-menu.tsx`, `ui/sidebar.tsx`, `ui/table.tsx`, `ui/tabs.tsx` — **leave them.** They're shadcn scaffolding and quoting will use `tabs` and `table`.

**Not dead, do not touch:** the 11 pricing engine modules with no non-test importer (`cabin-complexity.ts`, `cabin-rates.ts`, `cabin-service-plans.ts`, `is-com-rates.ts`, `is-com-recurring.ts`, `is-res-complexity.ts`, `is-res-rates.ts`, `monthly-service.ts`, `package-rate.ts`, `service-labor.ts`, `sma.ts`). These are the prompt 09–14 engines staged for quoting. `src/features/cron/purge-run.ts` is likewise a documented stub, not dead code.

---

## 8. `dismissPhoneNumber` is a Server Action with no Zod validation

`src/features/phone/actions.ts:11-13` takes a bare `groupKey: string` and passes it to `dismissWhereForGroupKey`, violating §8 and §11 ("`schema.parse(raw)` before the Prisma call"). The non-numeric branch (`group-key.ts:65`) becomes `{ id: groupKey, dismissed: false }` — safe today, but this builds a mass-update `where` clause with no validation in front of it, and the raw error string is returned to the client (`actions.ts:32`).

**Fix:** add `dismissPhoneNumberSchema` to a new `src/features/phone/schemas.ts` and parse first.

---

## 9. `revalidateMaterials()` misses every detail route and two catalog tabs

`src/features/materials/actions.ts:38-48` revalidates only `/materials`, `/materials/domains`, `/materials/categories`, `/materials/attributes`, `/materials/items`. It omits `/materials/{domains,categories,items,attributes}/${id}`, `/materials/consumables`, `/materials/equipment`, `/materials/import-export`. After `updateItem` (`:697`) or `updateCategory` (`:376`) the user is typically sitting on the detail page they just edited and sees stale values.

**Fix:** thread the entity id in — `revalidateMaterials(id?)` — and revalidate the detail path. `src/features/crm/actions.ts:38-48` already does this correctly; copy that shape.

---

## 10. Documentation corrections to `AGENTS.md`

- §6 says "`canInvite(actorRole, targetRole)` governs who can invite whom." It governs nothing: `INVITABLE_ROLES`, `invitableRoles`, `canInvite` and `canManageUsers` in `src/config/permissions.ts:118-137` have **zero** call sites, and `src/app/accept-invite/page.tsx` is a static "will be wired in a follow-up" placeholder — while `/accept-invite` is a live `PUBLIC_PREFIXES` entry and the `Invitation` model and migration exist. Correct §6 to say the invite flow is not built.
- Related and worth fixing in code: `src/lib/auth.ts:43` defaults new users to `role: "power_user"` (materials write + pricing write + crm write/archive). That is a permissive default with no invite gate in front of it, held shut only by `disableSignUp: true` (`:36`). **Change the default to `field_tech`.**
- §9's env var list is missing nine vars that `src/` actually reads: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SESSION_IDLE_MINUTES`, `GEOAPIFY_API_KEY`, `OPENPHONE_API_KEY` / `OP_API_KEY`, `SERVICE_PHONE` / `OP_PHONE_NUMBER`, `OP_WEBHOOK_SECRET` / `OPENPHONE_WEBHOOK_SECRET`. Four are secrets, and the four dual-name pairs contradict §9's own "never invent a new env var name without checking `.env.example` first." Document them, and collapse each dual-name pair to one canonical name with the alias marked deprecated. (No secret currently leaks to the client — the only `NEXT_PUBLIC_` vars are a URL and a timeout.)
- §4 lists `AppHeader` and `StatusBadge` as live; neither is referenced.

---

## Acceptance

- `npm test` (new) runs the whole suite, including `validation.test.ts`, and passes.
- `npm run typecheck`, `npm run lint` clean.
- Manual: sign in as a `field_tech` and hit `/materials/items/new` → redirected, not a 500.
- Manual: the dashboard greeting matches Eastern time, and the activity feed shows no hydration warning in the console.
