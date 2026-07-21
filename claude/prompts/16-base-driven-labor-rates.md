# Build prompt: base-driven derived labor rate calculation (logical fix)

## The bug

The Labor Rates page treats all five per-position rate columns (base, cost, standard, after-hours, holiday) as independently stored authoritative values, with the multiplier config shown as "transparency / recompute only." That's backwards. **The Base Rate is the only real input; every other column must derive from it through the scope's multipliers, live.** Right now editing a multiplier doesn't drive the rates, and the stored rates can drift out of sync with the multipliers. Fix the direction of authority.

This is a focused logic fix — do not touch the other pricing models, the scope system, or the engines' interfaces. Applies identically to all three labor scopes (IS Commercial, IS Residential, Cabin Services); only the base rates and multiplier values differ per scope.

## The calculation chain (authoritative)

Per position, given the position's `baseHourlyRate` and the scope's `LaborRateConfig` multipliers:

```
cost      = base     × burdenMultiplier
standard  = cost     × standardBillingMultiplier     (the markup on cost — e.g. 1.30 = 30%)
afterHours = standard × afterHoursMultiplier
holiday   = standard × holidayMultiplier
discounted = standard × discountedMultiplier          (only if discountedMultiplier is set; Cabin)
```

Structural facts that must hold (they hold across all three sheets — only the numbers differ):
- `cost` derives from **base**.
- `standard` derives from **cost**.
- `afterHours` and `holiday` both derive from the **standard** rate — not from cost, not from base.
- `discounted` (Cabin) derives from **standard**.

`base` is the only manually-entered position value. `burden`, `standardBillingMultiplier`, `afterHours`, `holiday`, `discounted` are the scope-level editable inputs. Everything else is computed.

## Source of truth + recompute

- **Base + the scope multipliers are the source of truth.** The `cost`/`standard`/`afterHours`/`holiday`/`discounted` columns are derived. Reverse the current "stored rates authoritative, multipliers = transparency only" framing (including the subtitle text on the page).
- Use **one** shared pure function to compute a position's derived rates from `(base, config)` — reuse/repair the existing `recompute.ts` helper from prompt 09 rather than writing a second formula. Every place that needs the rates (the admin table, the quote/service engines, any export) goes through this one function so there is exactly one definition of the chain.
- Recompute-and-persist strategy: when a position's **base** is saved, recompute and persist that position's derived columns. When a scope **multiplier** is saved, recompute and persist **every position in that scope**. This keeps runtime reads (and the downstream quote/service/SMA/estimate/job consumers) reading stable stored values, while base + multipliers remain the true source. (Persisting the derived values is a materialized cache, not a second source of truth — always regenerated from the formula, never hand-edited.)

## UI behavior

- On each Positions row, **only Base is an editable field.** Cost / STD / AH / HOL (/ Discounted) render as **read-only, computed** values that update live as Base or the multipliers change (show the recomputed preview before save if practical, and the persisted value after).
- The Rate multipliers panel stays editable (Burden, Standard billing, After hours, Holiday, Discounted-optional). Saving it recomputes all positions in the scope. Update the panel's subtitle from "transparency / recompute only" to something accurate, e.g. "These drive every position's rates. Base × Burden = Cost; Cost × Standard billing = Standard rate; After-hours and Holiday multiply the Standard rate."
- Do not let anyone type directly into Cost/STD/AH/HOL — they're outputs. (If Ryan later wants a manual per-position override, that's a separate decision; not now.)

## Seed values — leave them, just make them live

Do **not** change the currently seeded base rates or multiplier values. Ryan tunes these by hand now that the fields actually drive the math. (He's noted his intended logic is roughly burden ~1.35–1.40 and a 1.30 standard markup, which differs from the master-sheet seed of burden 1.85 / standard-billing 1.89 (Commercial) / 1.40 (Residential); he will set the final values himself in the editable fields. Don't pre-change them and don't block on it.) Base rates confirmed by Ryan: IS positions Tech 1&2 $18, Senior $26, Programmer $32, Service Tech $22; Cabin base rates per its sheet.

## Future seam (do not build now)

The Base Rate is currently a manual per-position average of what Ryan pays that role. Later, employee profiles (with individual pay rates) will live in the system and the Base Rate will be computed as the average across people in that position, feeding job costing and payroll. Model/label the base rate so that future source is a clean swap (it's an input today, a derived average later) — but **do not build employee profiles, job costing, or payroll now.** Just don't hardcode assumptions that would block it.

## Non-goals

- No changes to the quoted-blend or service-ticket engines' logic beyond reading the (now correctly derived) standard/AH/holiday rates through the shared function.
- No changes to complexity, recurring, materials, or scope models.
- No employee profiles, job costing, or payroll.
- No manual override of derived rate columns.
- Don't alter the seeded base rates or multiplier values.

## Verification checklist

- `npm run typecheck`, `npm run lint` clean; `npm run build` on Ryan's machine.
- Editing a position's Base and saving recomputes that row's Cost/STD/AH/HOL from the chain; other positions unchanged.
- Editing a scope multiplier (e.g. Burden) and saving recomputes every position in that scope; positions in other scopes unchanged.
- With the seeded values, the derived numbers reproduce the current display (e.g. Residential Tech 1&2: 18 × 1.85 = 33.30 cost; × 1.40 = 46.62 standard; 46.62 × 1.45 = 67.60 AH; 46.62 × 1.75 = 81.59 holiday) — i.e. the formula, not stored constants, produces them.
- Change Residential standard-billing multiplier to 1.30 in the UI → every Residential position's Standard/AH/Holiday drop accordingly and persist; no code change needed.
- Cost/STD/AH/HOL fields are not directly editable anywhere; Base is.
- One shared compute function is the only place the chain is defined (grep: no duplicated rate formula).
- Update `AGENTS.md` / `.cursor/rules/` to state base + multipliers are authoritative and the rate columns are derived, and note the future employee-profile → base-rate seam.
