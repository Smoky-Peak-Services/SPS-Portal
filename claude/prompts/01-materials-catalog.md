# Build prompt: materials catalog + attributes

Paste this whole file into Cursor (or `@`-mention it) as the task brief. It is scoped to one thing on purpose: the materials catalog. Quoting/estimating, work orders, and everything downstream get built later, on top of this.

## Read first

- `AGENTS.md` (repo root) — full engineering handbook. Section 2a explains why the last buildout got reset and what "one thing at a time, tested at each step" means here.
- `.cursor/rules/*.mdc` — same guardrails, short form.
- `claude/project-context.md` §7.1 and §8 — why the materials catalog exists and how tax classification is supposed to work.

Don't start writing code until you've read `AGENTS.md` at least once this session.

## Why materials first

Quoting/estimating is the next feature area, but quoting can't be built on nothing: every estimate line either references a catalog item or it's freeform, and the whole point is to stop typing the same part descriptions and tax classifications over and over. Materials is the foundation quoting sits on, so it goes first, on its own, fully working and tested before quoting touches it.

## Non-goals for this pass

Do not build any of the following yet, even though they're the obvious next steps — they belong to the quoting/estimating pass:

- `Estimate` / `EstimateLine` models or any quote-builder UI.
- Actual part numbers, manufacturer, substitution policy, or EOL-replacement fields. Those are quote-line concepts (a specific vendor's part chosen at quote time), not catalog concepts — see "Substitution and part numbers" below for why that split is deliberate.
- Any Stripe API call, tax calculation, or tax rate lookup. This pass only stores a tax **classification** per item (see "Tax classification" below) so a later pass can hand it to Stripe. Nothing here computes or charges tax.
- Vendor/RFQ/purchase-order anything.
- Packages/kits (bundles of items). Worth having eventually, not required for the first working version — call it out as a stretch goal, don't block on it.

If you find yourself writing any of the above, stop and flag it rather than continuing.

## Reference: SPS Portal 1.0 already solved most of this

There's a prior build, `SPS Portal` (no "2.0"), in the same parent folder as this repo, on a different, much larger stack (payroll, RFQ, Stripe billing, tax engine — none of which apply here). Its materials system, though, went through real iteration and landed somewhere good: `prisma/schema.prisma`, the block from `enum AttributeInputType` through `model CatalogPackageLine` (roughly the last ~300 lines of the ops schema). That's the reference for the hierarchy + attribute + tax-classification shape. Read it before designing anything from scratch.

Worth knowing about that history so you don't repeat it:

1. The very first version was a flat `material` table with a separate `material_attribute` join table.
2. That got dropped for a flat `tags TEXT[]` column on `material` — simpler, but not structured enough to drive required fields or facet filtering.
3. That got dropped too, replaced by the real EAV system: `Catalog` → `CatalogDomain` → `CatalogSub` → `CatalogItem`, with `CatalogAttribute` / `AttributeOption` / `AttributeAssignment` / `ItemAttributeValue` as a proper attribute layer. This is the one that stuck, and it's the one to build from.

Two things about even that final version to do differently here, because they were sloppiness that survived rather than deliberate design:

**Don't reintroduce a parallel scope/division concept.** V1's `Catalog` root existed just to scope everything to a division + segment combination (`code: "IS_COM" | "IS_RES" | "CAB"`), duplicating an already-existing `PricingScope` enum from an earlier pass ("Code values intentionally mirror legacy PricingScope strings" — that's a tell that the migration was patched over, not redesigned). This repo already has a real `Division` model (`prisma/schema.prisma`, ops schema) with a `segments String[]` field, and `src/config/company.ts` already enumerates divisions and their segments (`Segment = "commercial" | "residential" | "str"`). Scope the top of the materials hierarchy directly to `(divisionId, segment)` — add a Prisma `Segment` enum (`COMMERCIAL | RESIDENTIAL | STR`) mirroring `company.ts`, and put `divisionId` + `segment` straight on the domain-level model. No separate root/scope table.

**Don't scope attributes to a division.** V1 scoped `CatalogAttribute` to its `Catalog` root, meaning a reusable attribute like "Manufacturer" or "Finish" had to be redefined per division even when it meant the same thing everywhere. Attributes should be global, reusable definitions; per-category applicability (required, filterable, variant-defining) is already handled by the assignment join table one level down. Don't duplicate the same attribute per division.

## Data model to build

Everything below is new, additive, ops-schema only (`prisma/schema.prisma`) — none of this is customer/PII data, so the ops/PII split (`AGENTS.md` §5) isn't in play here, but run `npm run test:schema-guard` after the migration anyway, out of habit.

```
enum Segment { COMMERCIAL, RESIDENTIAL, STR }
enum MaterialAttributeInputType { SELECT, MULTISELECT, TEXT, NUMBER, BOOLEAN }
enum MaterialTaxProfile { REAL_PROPERTY, TPP }

model MaterialUnit
  - code (unique, e.g. EACH, FT, BOX, ROLL), name, isActive

model MaterialDomain            // top-level grouping, e.g. "Access Control", "Structured Cabling"
  - divisionId (FK Division), segment (Segment)
  - name, slug, description, sortOrder, isActive
  - unique (divisionId, segment, slug)

model MaterialCategory          // part-level category under a domain, e.g. "Card Readers"
  - domainId (FK MaterialDomain)
  - name, slug, description, sortOrder, isActive
  - requiresManualPartNumber: Boolean @default(false)   // see "Substitution and part numbers"
  - taxProfile: MaterialTaxProfile @default(TPP)          // category-level default
  - stripeTaxCode: String?                                 // category-level default
  - unique (domainId, slug)

model MaterialAttribute         // global, reusable attribute definition
  - name, slug (globally unique), inputType (MaterialAttributeInputType)
  - unit: String?   // for NUMBER type, e.g. "ft"
  - isActive

model MaterialAttributeOption   // choices for SELECT / MULTISELECT
  - attributeId (FK MaterialAttribute, cascade)
  - value (stable machine key), label (human-readable), sortOrder, isActive
  - unique (attributeId, value)

model MaterialAttributeAssignment   // links an attribute to a category
  - categoryId (FK MaterialCategory), attributeId (FK MaterialAttribute)
  - isRequired, isFilterable, isVariantDefining: Boolean
  - defaultOptionId: String? (FK MaterialAttributeOption)
  - sortOrder
  - unique (categoryId, attributeId)

model MaterialItem              // the actual catalog line. No SKU/part number — see below.
  - categoryId (FK MaterialCategory), unitId (FK MaterialUnit)
  - name
  - laborUnits: Decimal @default(0)   // hours per unit, feeds future quoting
  - laborUnitNotes: String?
  - isConsumable: Boolean @default(false)
  - baseCost: Decimal?, markupPct: Decimal?, wasteFactorPct: Decimal?   // meaningful only when isConsumable
  - supplier: String?, notes: String?, isActive: Boolean
  - taxProfile: MaterialTaxProfile?    // null = inherit category's default
  - stripeTaxCode: String?             // null = inherit category's default
  (skip the override-reason/override-by/override-at audit trail v1 had on this field for now —
   flag it to Ryan as a fast-follow if he wants an audit trail on tax overrides from day one,
   don't build it speculatively)

model MaterialItemAttributeValue    // EAV values, one item can have many
  - itemId (FK MaterialItem, cascade), attributeId (FK MaterialAttribute)
  - optionId: String? (FK MaterialAttributeOption, for SELECT/MULTISELECT)
  - valueText: String?, valueNumber: Decimal?, valueBool: Boolean?   // for TEXT/NUMBER/BOOLEAN
  - unique (itemId, attributeId)
```

Naming note: it's fine to rename these to whatever reads best in this codebase (`MaterialDomain` vs `CatalogDomain`, etc.) as long as the shape holds — these names just avoid colliding with a future `Catalog` concept if one ever needs to mean something else.

### Tax classification (not tax calculation)

`taxProfile` and `stripeTaxCode` are pure metadata, inherited item → category → nothing (leave the item/category null rather than inventing a hardcoded fallback code — an unclassified item should show up as needing classification, not silently default to something that might be wrong). This is exactly the guardrail in `AGENTS.md` §11: never compute tax in application code. All this does is let a future billing pass hand Stripe's tax engine the right code per line. If you're tempted to add rate lookups, jurisdiction logic, or anything that calculates a dollar amount of tax, that's out of scope here — stop and flag it.

### Substitution and part numbers

`MaterialCategory.requiresManualPartNumber` is the only substitution-related field this pass needs. It's a flag meaning "when someone eventually builds a quote line in this category, force them to enter a real part number and manufacturer, because the spec can't float." The actual `partNumber`, `manufacturer`, `substitutionPolicy` (comparable-allowed vs locked), and EOL-replacement fields are quote-line concepts in v1 (they live on `EstimateLine`, not the catalog item) — deliberately, because a catalog item is a generic spec (e.g. "Card Reader — Wiegand — 125kHz"), not a locked-in vendor SKU, and the actual part chosen can vary per quote. Don't add part-number fields to `MaterialItem` — that's next phase's problem, and adding it now duplicates data that will just go stale.

### Validation rule to enforce in code, not just comment

An item's attribute values (`MaterialItemAttributeValue`) may only reference attributes that are actually assigned to that item's category (`MaterialAttributeAssignment`). Enforce this in the Server Action, not just in a comment — reject the write if someone tries to set a value for an unassigned attribute. Also enforce `isRequired` assignments: creating/publishing an item should fail validation if a required attribute has no value.

## Application layer

Follow the existing convention (`AGENTS.md` §4, §8):

- `src/features/materials/schemas.ts` — Zod schemas for every create/update action below.
- `src/features/materials/actions.ts` — `"use server"` Server Actions, each starting with `requireArea("materials")` (new area key — add it to `AREA_ROLES` in `src/config/permissions.ts`, admin + staff for now), then `schema.parse(raw)`, then the Prisma call, then `revalidatePath(...)`.
- `src/features/materials/components/` — forms and lists.
- `src/app/(portal)/materials/` — admin pages: domains, categories (with their attribute assignments), attributes (with their options), and items (with their attribute values). This is back-office data entry, not a customer-facing catalog browser — build it as plain CRUD tables/forms, nothing fancy.
- Add a `Materials` entry to `src/config/nav.ts` (admin/staff roles, desktop surface — this is not a field-tech screen).

The whole point of "fully modular, buildable from the ground up" is that none of this taxonomy should ever require a code change to extend: adding a new domain, category, attribute, option, or item is a data operation through this UI, never a new enum value or a new file. If you catch yourself hardcoding a list of categories or attributes anywhere in application code, that's the design failing — the whole point is that it's data, not code.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` all clean.
- `npm run db:generate` and a real migration (`npm run db:migrate`) applied, not just schema edits.
- Manually walk the full chain once through the admin UI: create a domain → a category under it (with `requiresManualPartNumber` and a tax profile set) → an attribute → an option on it → assign the attribute to the category → create an item → set its attribute value → confirm the unassigned-attribute rejection and the required-attribute validation both actually fire.
- Update `AGENTS.md` (§4's "what's actually here" list, and add a new section documenting the materials model the same way §5 documents the ops/PII split) and `.cursor/rules/` once this is real, the same way those docs were kept current through the rest of this project. Stale docs here are exactly the failure mode `AGENTS.md` §0 warns about.
