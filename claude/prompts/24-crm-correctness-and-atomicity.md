# Prompt 24 — CRM correctness: address forms, lead promotion, and write-path integrity

Read `AGENTS.md` §4, §5, §6, §8 and the "CRM Customer Profile (prompt 20) + Leads / Quo (prompt 21)" subsection first.

Good news up front, so you don't go looking: **the authz layer is clean.** All 17 exported actions in `src/features/crm/actions.ts` plus `dismissPhoneNumber` call `requireCrmWrite()` / `requireCrmArchive()` as the first statement, and nothing anywhere authorizes with `user.role === "admin"`. Don't change that layer.

---

## 1. FATAL — saving a client fails silently whenever no state is selected

`src/features/crm/components/address-autocomplete.tsx:310,380,394,415` render `line1` / `line2` / `city` / `postal` as `disabled={!stateReady}`, where `stateReady = isUsRegionCode(v.region)` (`:93`) is `false` until a state is picked.

**Disabled controls are excluded from the FormData entry list.** So `fd.get("hqLine1")` returns `null`. And `optStr` in `src/features/crm/schemas.ts:31` is:

```ts
const optStr = z.string().optional().or(z.literal(""));
```

which accepts `undefined` and `""` but **not `null`**. So `createCustomerSchema.parse` throws inside the server action, the client `await createCustomer(...)` rejects inside `startTransition` with no catch, and the user sees nothing happen at all — no client created, no error message.

This fires on:
- `/clients/new` where the HQ address is optional and left blank
- `RootOrgForm` save on any customer with no `hqRegion` — **which is every lead-promoted customer**
- `BillingProfileForm` save with no billing state
- "Add service location" without a state (`required` is not enforced on disabled inputs either, and `line1: z.string().min(1)` then receives `null`)

**Fix, both halves:**

1. In `schemas.ts`, make the optional-string helper null-tolerant:
   ```ts
   const optStr = z.preprocess((v) => v ?? "", z.string());
   ```
   (Note: `.or(z.literal(""))` on `z.string().optional()` was always a no-op — `z.string()` already accepts `""`.)
2. In `address-autocomplete.tsx`, render the address inputs `readOnly` rather than `disabled` so they still submit `""`. Keep the visual affordance and the "Select state first" placeholder.

Then add a `try/catch` around every `await <action>(...)` inside a `startTransition` in the CRM components and surface the error, so the next parse failure is visible instead of silent.

---

## 2. HIGH — lead promotion is neither transactional nor idempotent

`src/features/crm/actions.ts:783-818`. `customer.create` (with nested `billingProfile` + `contact`) at `:788` and `lead.update({ customerId })` at `:815` are two separate round trips.

- If the second call fails or the request is aborted between them: an orphan Customer + BillingProfile + Contact with no link back, and the lead still renders a "Promote" button (`src/app/(portal)/leads/[id]/page.tsx:105`). The next click creates a **second** customer.
- The `if (lead.customerId) return` guard at `:785` is a read-then-write race. `Lead.customerId` has only `@@index`, no `@unique` (`prisma/pii/schema.prisma:230,243`), so two tabs or a retry-after-timeout both see `null` and both create.

**Fix:**
- Add `@unique` to `Lead.customerId` in `prisma/pii/schema.prisma` + a PII migration. (Check for existing duplicates first; if any exist, report them rather than failing the migration silently.)
- Claim the lead conditionally, then create, inside a single `prismaPii.$transaction`:
  ```ts
  const claimed = await tx.lead.updateMany({
    where: { id: data.leadId, customerId: null },
    data: { /* placeholder claim */ },
  });
  ```
  Simplest correct ordering inside the transaction: create the customer, then `updateMany({ where: { id, customerId: null }, data: { customerId: customer.id } })`, and if `count === 0` throw to roll back the whole transaction and return `{ ok: true, id: <existing customerId> }` after re-reading the lead.

`prismaPii`'s proxy correctly forwards `$transaction`, so interactive transactions work here (they are already used in `createCustomer` / `updateCustomer` / `updateLeadStatus`).

---

## 3. HIGH — promotion bypasses the customer-type × division invariant

`createCustomer` (`actions.ts:79-91`) and `updateCustomer` (`:169-190`) both resolve `lockedDivisionSlugForCustomerType` and reject via `customerTypeDivisionError`. `promoteLeadToCustomer` uses `lead.divisionId` verbatim with the user-picked `data.type`.

The default lead division is `integrated-systems` (`src/config/company.ts:145`) and `PromoteLeadButton` offers STR (`promote-lead-button.tsx:12`). So promoting a website lead as STR produces `{ type: STR, divisionId: integrated-systems }` — a pair the codebase declares illegal ("STR clients must use Cabin Services", `src/features/crm/service-location.ts:36`). The account then shows under the wrong division filter, and the next profile save silently relocates it.

**Fix:** run the same locked-division lookup + `customerTypeDivisionError` inside `promoteLeadToCustomer` before creating. When the lead's division and the chosen type conflict, either use the type-locked division (and record it in the promotion `Activity`) or return an actionable error — decide with Ryan, but do not create the illegal pair.

---

## 4. HIGH — `e.currentTarget.reset()` after an await throws and blocks the refresh

`src/features/crm/components/activity-panel.tsx:59`, `contacts-panel.tsx:140`, `locations-panel.tsx:194`.

React nulls `currentTarget` once the synchronous dispatch ends. These calls sit inside `start(async () => { … await action(); … })`. So adding a note / contact / service location succeeds server-side, then the callback throws `TypeError: Cannot read properties of null (reading 'reset')` — and `router.refresh()` on the next line never runs. The new row does not appear until a manual reload.

(The earlier `new FormData(e.currentTarget)` in each handler is fine — it is synchronous.)

**Fix:** capture the element before the transition.

```ts
const form = e.currentTarget;
start(async () => {
  const res = await action(new FormData(form));
  // ...
  form.reset();
  router.refresh();
});
```

---

## 5. MEDIUM — destructive deletes are under-gated and leave dangling references

- `deleteLead` (`actions.ts:734`) hard-deletes a Lead and cascade-deletes its entire `Activity` history under `crm.write`, while merely **archiving** a Customer requires `crm.archive` (`:349`). The more destructive operation has the weaker gate.
- `deleteContact` (`:517`) does not clear `BillingProfile.pointOfContactId`, which is a plain `String?` with no FK and no cascade (`prisma/pii/schema.prisma:157`). The billing form then shows "No point of contact" while a stale id persists in the database.

**Fix:** gate `deleteLead`, `deleteContact` and `deleteServiceLocation` on `crm.archive`, and null `pointOfContactId` in the same transaction as `deleteContact`.

---

## 6. MEDIUM — no cross-record ownership validation on secondary ids

- `createCustomerActivity` (`actions.ts:646-654`) persists `serviceLocationId` without checking it belongs to `data.customerId` — the notes panel will then render another customer's site name (`activity-panel.tsx:99`).
- `updateBillingProfile` (`:400`) writes `pointOfContactId` without checking the contact belongs to `rootOrgId`.
- `createContact` (`:450`) and `createServiceLocation` (`:547`) never verify `customerId` exists, so a bad id surfaces as an unhandled Prisma P2003 → 500, inconsistent with `updateContact` / `updateServiceLocation`, which do a `findUnique` guard first.

**Fix:** validate parentage with a scoped `findFirst({ where: { id, customerId } })` before writing, and return an `ActionResult` error rather than throwing.

Context so you scope this correctly: there is **no per-user division binding anywhere** — `SessionUser` (`src/lib/session.ts:17-23`) carries only id/name/email/role/capabilities, and `DivisionMembership` is never read. Division is a UI filter, not a security boundary, and that is by design today. So this is a data-integrity fix, not a privilege-escalation fix. Don't build tenancy enforcement here; if Ryan wants it, that is its own prompt.

---

## 7. MEDIUM — two divergent lead-creation paths

| | `createLead` (`actions.ts:669-697`) | `handleLeadIngest` (`ingress/lead-handler.ts:190-213`) |
|---|---|---|
| Phone | normalized via `phoneForStorage` | raw string |
| Auto-disqualify by budget | **no** | yes (`company.crm.disqualifyBudgets`, sets `closedAt`) |
| `company` default | none | `"Residential"` |
| Creation `Activity` | **none** | `STATUS_CHANGE` written |

So a manually created lead has an empty history panel, and an "under $1k" budget taken over the phone is never auto-disqualified while the identical website submission is.

**Fix:** extract one `createLeadRecord(input, tx)` in `src/features/crm/` (or `src/features/ingress/`) used by both. Prompt 23 handles the phone normalization half — coordinate so you don't do it twice.

---

## 8. MEDIUM — duplicate heavy queries and doubled auth work per request

- `getCustomerProfile(id)` — customer + billingProfile + **all** contacts + **all** serviceLocations + 50 activities with a location join (`queries.ts:64-80`) — is called in `clients/[id]/layout.tsx:39` **and again** in every tab page (`page.tsx:16`, `contacts/page.tsx:15`, `billing/page.tsx:15`, `locations/page.tsx:15`, `notes/page.tsx:15`). Nothing is wrapped in `React.cache`, so it runs at least twice per navigation.
- `src/features/crm/authz.ts:8-16` — `requireCrmWrite` / `requireCrmArchive` call `requireUser()` and then `requireCapability()`, which calls `requireUser()` again. Every CRM write does 2× (session + `user.findUnique` + capability queries) against the ops DB.

**Fix:** wrap `getCustomerProfile` and `requireUser` in `cache()` from `react`; delete the redundant `requireUser()` at `authz.ts:9,14`.

---

## 9. MEDIUM — `optCoord` can never yield `undefined`, so the "leave unchanged" guards are dead

`src/features/crm/schemas.ts:33-36` transforms both `""` and `undefined` to `null`. So `data.hqLat === undefined` (`actions.ts:224-225`) and `data.latitude === undefined` (`:607-608`) are always false, and any partial update that omits coordinates writes `null` instead of leaving the stored value alone — a future rename-only update on a service location wipes its map pin.

**Fix:**

```ts
const optCoord = z
  .union([z.coerce.number(), z.literal("")])
  .optional()
  .transform((v) => (v === "" ? null : v === undefined ? undefined : Number(v)));
```

---

## 10. MEDIUM — unbounded list queries

`listCustomers` and `listLeads` (`queries.ts:26,115`) have no `take`, no cursor, no pagination. `getCustomerProfile` loads every contact and every service location. `/leads` pulls all active leads and partitions them in JS (`leads/page.tsx:89`, `leads.filter(...)` inside a 4-column map). Search uses `contains` on unindexed `displayName` / `generalEmail` / `mainPhone` / `name` / `email` / `phone` / `company` → sequential scans.

**Fix:** add `take` + cursor pagination, and use per-column `count()` for the board headers instead of loading every row to count them. Defer trigram indexes until the row counts justify them — note it in a TODO with the threshold.

---

## 11. LOW — `revalidatePath` gaps

- Call-log matching keys off `Contact.directPhone`, but `createContact` / `updateContact` / `deleteContact` / `createCustomer` never `revalidatePath("/call-log")`, while `createLead` (`:695`), `deleteLead` (`:747`) and `promoteLeadToCustomer` (`:822`) do. Add `/call-log` to `revalidateClients`.
- `deleteLead` calls `revalidateLeads()` with no id (`:746`), so `/leads/[id]` is not invalidated — unlike `updateLeadStatus` (`:729`). Pass `data.id`.
- `handleLeadIngest` revalidates nothing after creating a lead. Add `revalidatePath("/leads")`.

---

## 12. LOW — Zod bounds and one real rejection bug

- `optStr` has no `.max()`, so `notes`, `summary`, `website`, `hqLine1`, `billingName`, `taxExemptionNumber` accept unbounded input, while the parallel ServiceLocation fields are capped (`line1` 200, `city` 100, `region` 50, `postalCode` 20). Make them consistent.
- `country: z.string().max(2)` (`schemas.ts:141`) **rejects `"USA"`**. Either widen to 3 or normalize to ISO-2 on input.
- `region: z.string().max(50)` accepts any string server-side even though the UI restricts it to `US_REGION_OPTIONS`. Validate against the enum.
- `complexitySelections` is validated in both create and update schemas but no UI ever sends it — leave it, it's for quoting.
- All enums match the PII schema exactly. No drift. Don't touch them.

---

## 13. LOW — call-log triage link can exceed the lead message cap

`src/features/phone/components/call-log-client.tsx:175-181` packs `leadMessage` (summary + SMS + full transcript, built at `phone/queries.ts:38-42`) into a `?message=` param, but `createLeadSchema.message` caps at 5000 (`schemas.ts:208`). A long voicemail transcript makes "Create lead" throw a ZodError with no user-facing message. Truncate to 4900 with an ellipsis before building the link.

---

## Acceptance

- `npm run typecheck`, `npm run lint` clean.
- Manual: create a client with no state selected → it saves. Save a lead-promoted customer's Root Org tab without touching the address → it saves.
- Manual: double-click Promote on a lead → exactly one customer, and the second click is a no-op returning the same id.
- Manual: add a note, a contact, and a service location → each appears immediately without a manual reload.
- New test asserting `promoteLeadToCustomer` never produces `{ type: "STR", divisionId: <integrated-systems> }`.
