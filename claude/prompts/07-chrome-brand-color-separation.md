# Build prompt: separate internal chrome color from brand color

This is a theme-token change, not a redesign. Every interactive shadcn element (buttons, focus rings, active sidebar state, hover accents) is wired through CSS variables in `src/app/globals.css`, and `tailwind.config.ts` just points at those variables — nothing is hardcoded per component (confirmed: no `teal-`/`cyan-` Tailwind classes or brand hex literals exist in any `.tsx` file). That means this fix lives entirely in one file's token values, not a hunt across every page.

## The problem, precisely

`--primary`, `--ring`, `--accent`, `--sidebar-primary`, and `--sidebar-accent` are all currently set to the same hue as `--brand-primary`/`--brand-accent` (`#0D9488`/`#2DD4BF`, Smoky Peak's actual brand teal, defined separately in `company.ts`). Since shadcn routes nearly all interactive chrome through those five tokens, the brand color shows up on every button, focus ring, and active nav state — not just the logo. Ryan's rule: brand color belongs only on customer-facing surfaces (none built yet — future quote/invoice PDFs, customer portal login). Internal chrome should be a distinct, neutral-to-the-brand accent color, inspired by the reference renderings Ryan shared (dark navy chrome, one restrained blue for interactive state, color reserved elsewhere for data differentiation only).

`company.brand.primary`/`company.brand.accent` in `company.ts` stay exactly as they are — don't touch that file. This prompt only touches the shadcn/chrome token layer in `globals.css`.

## Exact token changes (`src/app/globals.css`, inside the `:root, .dark` block)

Change these five roles from brand teal (hue ~180) to a chrome blue (hue ~259, roughly Tailwind's blue-500 family) that has no relationship to the brand color:

| Token | Current | New |
|---|---|---|
| `--primary` | `oklch(0.7 0.12 180)` | `oklch(0.62 0.19 259)` |
| `--primary-foreground` | `oklch(0.16 0.03 200)` | `oklch(0.98 0.005 259)` |
| `--ring` | `oklch(0.7 0.12 180)` | `oklch(0.62 0.19 259)` |
| `--accent` | `oklch(0.28 0.04 185)` | `oklch(0.26 0.05 259)` |
| `--accent-foreground` | `oklch(0.95 0.02 180)` | `oklch(0.95 0.02 259)` |
| `--sidebar-primary` | `oklch(0.7 0.12 180)` | `oklch(0.62 0.19 259)` |
| `--sidebar-primary-foreground` | `oklch(0.16 0.03 200)` | `oklch(0.98 0.005 259)` |
| `--sidebar-accent` | `oklch(0.24 0.04 185)` | `oklch(0.24 0.05 259)` |
| `--sidebar-accent-foreground` | `oklch(0.95 0.02 180)` | `oklch(0.95 0.02 259)` |
| `--sidebar-ring` | `oklch(0.7 0.12 180)` | `oklch(0.62 0.19 259)` |

Also fix `--chart-1`, which currently matches the brand hue too, and adjust `--chart-4` so it doesn't collide with the new primary blue:

| Token | Current | New | Represents |
|---|---|---|---|
| `--chart-1` | `oklch(0.7 0.12 180)` (brand teal) | `oklch(0.62 0.19 259)` (blue, matches new primary) | e.g. revenue/primary metric |
| `--chart-2` | `oklch(0.72 0.15 145)` | unchanged (green) | |
| `--chart-3` | `oklch(0.75 0.14 55)` | unchanged (orange) | |
| `--chart-4` | `oklch(0.65 0.15 250)` | `oklch(0.65 0.16 300)` (purple — was too close to the new blue primary) | |
| `--chart-5` | `oklch(0.65 0.18 25)` | unchanged (red) | |

Leave `--background`, `--card`, `--popover`, `--muted`, `--border`, `--input`, `--sidebar`, `--sidebar-foreground`, `--sidebar-border`, and `--destructive` alone — they're already neutral (hue ~250, low chroma), not brand-derived, and not what's driving the complaint.

## Secondary polish (do this too, same file, low effort): filled active nav state

`app-sidebar.tsx`'s active nav item currently just tints the text color (`text-sidebar-primary`) on a faint background. The reference renderings show active nav items as a solid filled pill — solid `sidebar-primary` background, `sidebar-primary-foreground` text/icon, full contrast. Update the `active &&` branch in both the main nav and footer nav `<Link>` `className` in `app-sidebar.tsx` to use `bg-sidebar-primary text-sidebar-primary-foreground` instead of `bg-sidebar-accent font-medium text-sidebar-primary`, matching the look in the renderings.

## Non-goals

- No changes to `company.ts` / `company.brand.*` — those values stay as the real brand color, for whenever customer-facing surfaces (quote PDFs, customer portal) get built.
- No background/card darkness change — current values already read as neutral dark navy, not teal-tinted; don't chase the renderings' exact background darkness without a visual side-by-side first.
- No changes to `divisionTheme()` in `company.ts` — it's unused dead code right now (not wired into any component), not a live bug. Leave it; whoever wires up division badges later should revisit its light-mode text classes for dark-mode legibility then.
- No new component-level color classes — if the fix requires touching anything beyond `globals.css` and the one `app-sidebar.tsx` active-state tweak, stop and flag it; the point of this prompt is that it shouldn't.

## Verification checklist before calling this done

- `npm run typecheck`, `npm run lint` clean.
- Grep the built app for any remaining `oklch(... 180)` / `oklch(... 185)` in `globals.css` — should be zero occurrences of the old brand hue outside `--brand-primary`/`--brand-accent` (which aren't touched).
- Visually confirm: primary buttons, focus rings, and the active sidebar item now render blue, not teal. The Smoky Peak logo mark in the sidebar header is unaffected (it's a static image asset, not a CSS token, and showing the real logo internally is fine — only the interactive/chrome color role was the problem).
- Confirm `company.brand.primary`/`company.brand.accent` are unchanged and still `#0D9488`/`#2DD4BF` in `company.ts`.
- Confirm chart colors on the dashboard no longer include a teal that matches the brand hex.
