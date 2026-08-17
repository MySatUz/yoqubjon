<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system

Tailwind v4, configured entirely in `src/app/globals.css` (`@theme inline`) — there
is no `tailwind.config.js`. Components use Tailwind's own colour scale directly;
there is no parallel token vocabulary, on purpose. An earlier one drifted out of
sync with the classes actually in use and nothing caught it.

These four scales are the whole system. Reaching outside them is drift — if a
design genuinely needs a sixth colour or a fifth radius, change this file in the
same commit.

**Colour — five families, no more.**

| role | class | means |
|---|---|---|
| accent | `blue-600` / `blue-700` hover / `blue-50` subtle | primary action, active nav, links |
| neutral | `slate-*` | everything structural |
| success | `emerald-600` | correct answer, active subscription, approved payment |
| warning | `amber-600` | **pending / expiring only** — never "look here" emphasis |
| danger | `red-600` | wrong answer, validation error, destructive action |

No `green`, `teal`, `rose`, `orange`, `indigo`, `violet`. `emerald` and `green`
both meaning "correct" was the single most visible inconsistency in the old UI.
Do not colour a row of cards or stat tiles in rotating hues — one accent
treatment, and let the icon and label carry the difference.

**Weight — four steps.** `font-bold` is retired; it sat ambiguously between two
real steps.

- `font-black` — display headings at `text-3xl`+ and large numeric metrics **only**
- `font-semibold` — section headings, card titles, table headers, buttons
- `font-medium` — nav links, labels, badges, uppercase micro-captions
- (unset) — body copy and descriptions

Numeric values that change in place (scores, timers, counts) get `tabular-nums`.

**Radius — four steps.** `rounded-lg` inputs and badges · `rounded-xl` buttons and
inner elements · `rounded-2xl` cards, panels and modals · `rounded-full` avatars
and pills. No `rounded-3xl`, no arbitrary `rounded-[2rem]`.

**Elevation — three steps, one light source, never tinted.** `border-slate-200`
alone for a flat card · `+ shadow-sm` for a raised one · `shadow-lg` for
dropdowns and popovers · `shadow-2xl` for modals. Coloured shadows
(`shadow-blue-200`, `shadow-emerald-100`, …) are out — the default neutral
shadow is the single light source. The two arbitrary upward shadows on the
sticky bottom bars are deliberate: Tailwind has no utility for a shadow cast
upward.

**Not in this codebase:** gradients, `backdrop-filter`, noise or grain overlays,
blurred colour "orbs", glassmorphism. They were removed on purpose — they read
as generated, and the blur layers kept the compositor busy for the whole
session. `globals.css` and `AppShellFrame.tsx` carry comments explaining the
performance half; do not reintroduce them.
