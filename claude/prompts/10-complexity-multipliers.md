# Build prompt: complexity multipliers (Integrated Systems Commercial)

Build after prompt 09 — this feeds adjusted hours *into* `distributeQuotedLabor`. Pure data + one calculation function, no job/quote entity.

## Decision that overrides the CSV (confirmed with Ryan)

The CSV's `Applied To` column and its notes say "Total Labor Cost." **Ignore that — multipliers modify HOURS, not dollars.** Ryan confirmed this directly. The multiplier adds *time*; the adjusted hours then flow through prompt 09's labor engine, which is what turns them into dollars. This means complexity work also raises the cost basis (you pay techs for the extra hours), which is the intended, realistic behavior.

**Strict rule for the code:** the system must NEVER multiply a labor dollar amount or total project price by a multiplier rate. Multipliers only ever touch `baseHours`. Put this in a comment on the calc function.

## Source of truth

`claude/prompts/samples/is-com-complexity-multipliers.csv` (copy the uploaded `...Complexity Multipliers.csv` there). Ten multipliers, verbatim:

| name | category | modificationRate | 
|---|---|---|
| Existing Conduit Reuse | STRUCTURAL | 0.08 |
| High Ceiling or Elevated Work Areas | STRUCTURAL | 0.10 |
| Confined Space Access | STRUCTURAL | 0.12 |
| After Hours Required Installation | ACCESS | 0.20 |
| Occupied Building Restrictions | ACCESS | 0.08 |
| Multi-Floor or Multi-Building Campus | STRUCTURAL | 0.12 |
| Prevailing Wage Requirements | COMPLIANCE | 0.18 |
| Data Center or Cleanroom Environment | COMPLIANCE | 0.15 |
| Historical or Protected Building Restrictions | COMPLIANCE | 0.15 |
| Escort or Access Limitations | COMPLIANCE | 0.12 |

Carry each row's full `Notes and Rules` text into a `description` field — estimators need to see when each applies. Store `modificationRate` as a **decimal** (0.08, not 8) per the user's explicit requirement.

## Data model

`ComplexityMultiplier`, scoped by `(divisionId, Segment)` like the labor rates and materials:
- `name`, `slug` (unique within scope), `category` (enum `ComplexityCategory { STRUCTURAL, ACCESS, COMPLIANCE }`), `modificationRate Decimal @db.Decimal(5, 4)`, `description String @db.Text`, `isActive Boolean @default(true)`, `sortOrder Int`.
- No `appliesTo` column — it's always labor hours by rule; don't model a variant that doesn't exist.

## Calculation function (additive, never compounded)

`calculateAdjustedLaborHours(baseHours, activeMultipliers)`:
- Each multiplier is computed **independently against `baseHours`** and the additions are summed. They do **not** compound.
- `additionalHours = Σ (baseHours × multiplier.modificationRate)` — equivalently `baseHours × Σ(rates)`, but compute and return the per-multiplier breakdown so the UI can itemize.
- `totalHours = baseHours + additionalHours`.
- No cap — every active multiplier applies in full regardless of how many stack (per CSV note 3).
- Return `{ baseHours, perMultiplier: [{ name, rate, additionalHours }], additionalHours, totalHours }` so the UI can show Base Hours / Additional Complexity Hours / Total Adjusted Hours (the user explicitly wants that visibility for estimators).
- `totalHours` is what gets passed to prompt 09's `distributeQuotedLabor` — reference that linkage in a comment, don't build the wiring (no quote entity yet).

## One nuance to flag in the prompt, not silently resolve

"After Hours Required Installation" (0.20) is a complexity multiplier, and its CSV note says it applies "in addition to standard after hours labor rates." So a genuinely after-hours job could both (a) select `LaborRateType.AFTER_HOURS` in the labor engine (higher $/hr) and (b) carry this +20% hours multiplier. Per the note that stacking is **intentional**, not a bug — but leave a code comment and a one-line note in the estimator UI so it's a visible, deliberate choice rather than accidental double-counting. Don't add logic that blocks or auto-resolves the combination.

## Worked examples to unit-test (from the user's spec, verify exactly)

- Base 14.0h + Occupied Building Restrictions (0.08): 14 × 0.08 = 1.12 → total **15.12h**.
- Base 14.0h + Confined Space (0.12) + Prevailing Wage (0.18): 14×0.12=1.68, 14×0.18=2.52, sum 4.20 → total **18.20h** (confirms additive, not compounded — compounded would be 14×1.12×1.18=18.50, which must NOT be the result).

## Admin surface

Light admin list under the same pricing area as labor rates, admin-gated, inline edit. Ten rows — no Excel pipeline needed.

## Non-goals

- No dollar/price multiplication anywhere — hours only.
- No compounding.
- No quote/job wiring — pure function only.
- No cap logic.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run test:schema-guard` clean.
- Seed lands exactly 10 multipliers for IS-Commercial with the exact rates and categories above.
- Unit tests reproduce 15.12h and 18.20h exactly; a compounding implementation (18.50h) fails the test.
- Test that `modificationRate` is stored/read as a decimal (0.08), not an integer percent.
- Confirm chaining into prompt 09: `distributeQuotedLabor(calculateAdjustedLaborHours(14, [confinedSpace, prevailingWage]).totalHours, ..., STANDARD)` runs on 18.20h.
- Update `AGENTS.md` / `.cursor/rules/` with the multiplier model and the hours-only rule.
