# Marketing site lead forms → Portal ingest (standard payload)

Use this on **Cabin Services**, **Integrated Systems**, and **Smoky Peak Services (parent)** contact forms so every site writes the same shape into portal PII `lead`.

## Endpoint

`POST https://portal.smokypeak.tech/api/v1/leads`

Headers:

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | yes | `application/json` |
| `x-ingest-key` | yes (per site) | That site’s `PORTAL_INGEST_KEY` / parent `INGEST_CLIENT_SECRET` |
| `x-ingest-secret` | recommended | Same `INGEST_SERVER_SECRET` as the portal |

Org routing (which PII `division` row owns the lead) comes from `x-ingest-key`, not from the JSON `division` field.

## Standard JSON body

Send **flat fields only**. Do **not** paste labels into `message`.

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "8655550100",
  "company": "Acme Property Mgmt",
  "division": "General Inquiry",
  "message": "Need a quote for camera install.",
  "budget": optional,
  "timeline": optional
}
```

| Field | Required | Maps to PII column | Notes |
|-------|----------|--------------------|-------|
| `name` | yes | `name` | Contact name |
| `email` | no | `email` | Valid email or omit/empty |
| `phone` | no | `phone` | |
| `company` | no | `company` | **Submitter’s company.** If omitted, empty, or whitespace, portal stores `Residential` |
| `division` | no* | `division` | **Form Division / inquiry-type dropdown** (string label). Not the org slug. |
| `message` | no | `message` | **Freeform body only.** No `Division:` / `Company:` / `Subject:` prefixes |
| `budget` | no | `budget` | Keep existing option values if the form has them |
| `timeline` | no | `timeline` | Same |

\*Strongly recommended: every site should send `division` from its inquiry-type / Division control.

Do **not** send `divisionSlug` unless you are secret-only auth with no key (parent/IS/Cabin all have keys; leave it out).

## Field mapping per site

### Smoky Peak Services (parent)

| Form control | JSON field |
|--------------|------------|
| Name | `name` |
| Email | `email` |
| Phone | `phone` |
| Company (optional) | `company` |
| Division (e.g. “Parent company / general inquiry”) | `division` |
| Message / details | `message` |

### Integrated Systems

| Form control | JSON field |
|--------------|------------|
| Name | `name` |
| Email | `email` |
| Phone | `phone` |
| Company | `company` |
| Division (e.g. “General Inquiry”) | `division` |
| Subject | fold into `message` as the first line, or drop Subject and use one textarea |
| Message | `message` |

Preferred: one message textarea. If you keep Subject, set:

`message = subject.trim() ? `${subject.trim()}\n\n${body}` : body`

Do not put Subject into `division` or `company`.

### Cabin Services

| Form control | JSON field |
|--------------|------------|
| Name | `name` |
| Email | `email` |
| Phone | `phone` |
| Company (optional; often blank for homeowners) | `company` |
| Division / inquiry type if present | `division` |
| Subject | same rule as IS (prefix into `message` or drop) |
| Message | `message` |

Blank company is fine; portal will store `Residential`.

## Stop doing this

Do not build message strings like:

```
Company: …
Division: …
Subject: …
```

Those belong in `company`, `division`, and `message` respectively.

## Example forward (server-side only)

```ts
await fetch(process.env.PORTAL_INGEST_URL!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ingest-key": process.env.PORTAL_INGEST_KEY!, // parent: INGEST_CLIENT_SECRET
    "x-ingest-secret": process.env.INGEST_SERVER_SECRET!,
  },
  body: JSON.stringify({
    name,
    email,
    phone,
    company: company?.trim() || undefined, // omit if empty → Residential
    division: divisionLabel?.trim() || undefined,
    message: message?.trim() || undefined,
  }),
});
```

## Acceptance checks

1. Cabin submit with blank company → PII `lead.company` = `Residential`, org slug = `cabin-services`.
2. IS submit with company filled → `lead.company` = that value, `lead.division` = dropdown label, org slug = `integrated-systems`.
3. Parent submit → same org as IS (`integrated-systems`), `lead.division` = parent inquiry label, `message` has no prefixed metadata lines.
4. `Select-String`-style check of stored `message`: no leading `Company:` / `Division:` lines from the forwarder.
