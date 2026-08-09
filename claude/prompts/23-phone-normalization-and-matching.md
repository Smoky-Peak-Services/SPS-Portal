# Prompt 23 — Phone number normalization and call/SMS matching

**Priority: P0 (functional).** Inbound calls and texts from real customers are silently failing to attach to their Contact or Lead. The Call Log UI hides the bug, because the UI and the write path use two different matching algorithms.

Read `AGENTS.md` §5 before starting. All models touched are in `prisma/pii/schema.prisma`.

---

## The bug

`src/features/phone/match-target.ts:37,51` matches with a SQL `endsWith` against the **raw stored string**:

```ts
where: { directPhone: { endsWith: national10 } }
where: { phone: { endsWith: national10 }, status: { notIn: CLOSED_LEAD } }
```

`national10` is bare digits (`"8655551234"`). But the stored values are not normalized:

| Write path | File | Stores |
|---|---|---|
| Website / phone lead ingest | `src/features/ingress/lead-handler.ts:197` | `phone: data.phone \|\| null` — raw form input |
| Create contact | `src/features/crm/actions.ts:456` | `directPhone: emptyToNull(data.directPhone)` — raw |
| Update contact | `src/features/crm/actions.ts:502` | raw |
| Promote lead → customer | `src/features/crm/actions.ts:808` | `directPhone: lead.phone` — copies the raw lead value |
| Manual lead create | `src/features/crm/actions.ts:686` | **normalized** via `phoneForStorage()` — the only one |

So a website lead that submitted `(865) 555-1234` is stored verbatim. When that person calls the Quo line, `parseUsPhone` yields `"8655551234"`, `endsWith "8655551234"` does not match `"(865) 555-1234"`, `matchPhoneTarget` returns `null`, and **no `Activity` is written to the lead**.

Meanwhile `src/features/phone/queries.ts:141,151` matches with `phoneLast10()`, which strips non-digits — so `/call-log` displays "matched to Lead X" while the lead's timeline stays empty. The two paths disagree, which is why this looks wired up.

Two further defects in the same function:
- `findFirst` on a non-unique column silently picks one row. A shared office line on several contacts, or two leads from one household, sends the activity to an arbitrary record (most recently updated wins).
- `endsWith` on an unnormalized international number aliases: `+49 30 55512345` has last-10 `3055512345`, a valid NANP Miami number. A German contact's record can absorb a Miami caller's activity — cross-customer PII mixing.

---

## What to build

### 1. Add an indexed, normalized last-10 column to both models

In `prisma/pii/schema.prisma`:

```prisma
model Contact {
  // ...
  directPhone     String?
  /// Last 10 digits of directPhone, normalized. Written by the app, never by hand.
  directPhoneNat  String?
  // ...
  @@index([directPhoneNat])
}

model Lead {
  // ...
  phone     String?
  /// Last 10 digits of phone, normalized.
  phoneNat  String?
  // ...
  @@index([phoneNat])
}
```

Also add `@@index([customerId, createdAt])` and `@@index([leadId, createdAt])` to `Activity` while you are in this file — `getCustomerProfile` (`src/features/crm/queries.ts:71-79`) orders the customer's entire history by `createdAt` to take 50, with no supporting index.

Generate a PII migration (`npm run db:migrate:pii`). Do **not** use `db:push:pii` for this.

### 2. Write the normalized value on every write path

Use the existing `phoneForStorage()` / `phoneNational()` helpers from `src/lib/openphone.ts`. Add a small shared helper — put it in `src/lib/phone-parse.ts` (which has no server-only concerns) so both CRM and ingest can use it:

```ts
export function phoneNat10(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : null;
  return last10 && isValidUsNational10(last10) ? last10 : null;
}
```

Set the new column alongside the raw column in **all** of:
- `src/features/ingress/lead-handler.ts:197`
- `src/features/crm/actions.ts:456` (createContact), `:502` (updateContact), `:686` (createLead), `:808` (promoteLeadToCustomer — both the customer's `mainPhone`-derived contact and the lead copy)

Leave the raw column as-is — it is what gets displayed. Normalize only into the new column.

### 3. Backfill

Add `scripts/backfill-phone-nat.ts` following the shape of the existing `scripts/backfill-tax-profiles.ts`. Iterate all `Contact` and `Lead` rows in batches, compute `phoneNat10(raw)`, write it. Add an npm script `backfill:phone-nat`. Report counts (rows scanned / rows set / rows where the raw value could not be parsed) so Ryan can eyeball how many are unparseable.

### 4. Match on the normalized column, and refuse to guess

Rewrite `matchPhoneTarget` in `src/features/phone/match-target.ts`:

- Query `directPhoneNat: national10` with **equality**, not `endsWith`.
- Use `findMany({ take: 2 })` instead of `findFirst`. If more than one row comes back, return `null` (ambiguous → leave it for manual triage in `/call-log`) rather than picking arbitrarily. Log the ambiguity with the number and the matched ids.
- Same for the `Lead` query against `phoneNat`.
- Keep the `isValidUsNational10` and `isPiiConfigured` guards.

### 5. Make the Call Log UI use the same matcher

`src/features/phone/queries.ts:112-160` bulk-loads `take: 2000` contacts and `take: 2000` leads and matches in JS. Past 2,000 rows a known customer's call renders as "Unknown caller" and gets triaged into a duplicate lead. It also silently disagrees with the write path.

**Fix:** collect the distinct `partyNat` values for the ~50 groups actually on screen, then do **one** `findMany({ where: { directPhoneNat: { in: keys } } })` per model and build a `Map<nat10, match>`. Drop both `take: 2000` calls. Apply the same "more than one match → ambiguous" rule as `matchPhoneTarget` so the UI and the write path can never disagree again.

Also raise or paginate the `phoneEvent.findMany({ take: 500 })` at `src/features/phone/queries.ts:57`, which silently truncates a busy 14-day window.

### 6. One-time repair pass (optional, ask Ryan first)

After the backfill, existing `PhoneEvent` rows whose `partyNat` now matches a Contact or Lead still have no `Activity`. Add a `--repair` flag to the backfill script that re-runs `upsertMatchedActivity` for undismissed `PhoneEvent` rows in the last 90 days. Because `Activity.externalId` is `@unique`, this is idempotent. **Do not run it without asking** — it writes into customer timelines.

---

## Acceptance

- New `src/features/phone/match-target.test.ts` cases: raw stored `"(865) 555-1234"` matches an inbound `"8655551234"`; two contacts with the same number return `null`; an international number whose last 10 happen to be NANP-valid does not match a different customer.
- New test that the Call Log matcher and `matchPhoneTarget` return the same answer for the same input.
- `npm run typecheck`, `npm run lint` clean.
- Manual: place a real test call from a number that exists on a lead created via the website form; confirm the `Activity` appears on the lead detail page, not just in `/call-log`.
