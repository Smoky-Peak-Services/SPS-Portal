# Prompt 20 — CRM Customer Profile

## Goal

Salesforce-style **Account** profile (not staff permission Profiles) for residential and commercial customers.

Hierarchy:

```text
Division (owning)
  └── Customer (Root Org / Account)
        ├── BillingProfile (1:1)
        ├── Contact[]
        └── ServiceLocation[]
```

All identity models live in the **PII** database. Ops will later hold string `customerId` / `serviceLocationId` only.

## Routes

| Path | Purpose |
|------|---------|
| `/clients` | Active list (search, division, type) |
| `/clients/new` | Create root org + billing stub + optional contact |
| `/clients/archive` | Archived accounts |
| `/clients/[id]` | Root Org tab |
| `/clients/[id]/billing` | Billing profile |
| `/clients/[id]/contacts` | Contacts |
| `/clients/[id]/locations` | Service locations |
| `/clients/[id]/activity` | Notes |

Desktop-only. Capabilities: `crm.access`, `crm.write`, `crm.archive`.

## Rules

- `Customer.type` (`RESIDENTIAL` | `COMMERCIAL` | `STR`) is CRM labeling, **not** catalog scope (`IS_COM` / `IS_RES` / `CS_STR`).
- One owning `divisionId` per customer in v1.
- Commercial service locations → `serviceLines: [INTEGRATED_SYSTEMS]` only.
- Billing complete = name + email + full address (app helper). Incomplete is OK to save; quoting will gate later.
- Vocabulary: Customer / Contact / ServiceLocation / BillingProfile. Never "Property" in new code.
- Do **not** add Job/Ticket, W-9 R2 upload, customer portal auth, or lead-promote UI in this prompt.

## Feature code

`src/features/crm/` — `actions.ts`, `schemas.ts`, `queries.ts`, `billing.ts`, `service-location.ts`, `authz.ts`, `components/`.

## Seed

Re-run capability seed (`db:seed` or permissions reset) so `crm.*` capabilities exist for roles.
