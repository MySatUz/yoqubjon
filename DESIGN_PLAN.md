# Design unification plan

Goal: remove the "AI-generated" visual fingerprint (gradients, glass, noise, blur orbs,
uniform 900 font weight) and converge the landing page and the app onto one design system.

Decisions taken up front:

- **Single accent: `blue`.** The landing moves off indigo/amber onto blue-600. The app
  (322 blue usages) stays as-is.
- **Real weight scale.** `font-black` becomes a deliberate exception, not the default.

Constraint from `AGENTS.md`: this is Next.js 16.2.6 with Tailwind v4 (`@theme inline` in
`src/app/globals.css`, no `tailwind.config.js`). Read `node_modules/next/dist/docs/` before
touching routing or layout files.

---

## 1. Diagnosis

Measured across the 50 `.tsx` files that carry markup (~9 500 lines).

### 1.1 Two disjoint design languages

| | Landing (`app/page.tsx`, `Navbar.tsx`) | App (dashboard / exam / admin) |
|---|---|---|
| Accent | indigo-600 + amber-500 | blue-600 |
| Surfaces | `gradient-hero`, `glass`, `glass-dark`, `noise-overlay` | flat white + `shadow-sm` |
| Depth | blurred colour orbs (`blur-3xl`) | borders |
| Headings | `gradient-text` clipped gradient | solid `text-slate-900` |

A visitor crossing `/` → `/dashboard` sees two different products.

### 1.2 The token layer is bypassed

`globals.css` declares `--accent-primary: #4f46e5` and exposes `--color-accent`,
`--color-surface`, `--color-surface-elevated` through `@theme inline`. Almost nothing
consumes them — components write literal `bg-blue-600` / `bg-white` / `bg-slate-50`
instead. The declared accent (indigo) is not even the accent actually in use (blue).

### 1.3 Duplicate semantic families

- **success:** `emerald-*` in 13 files **and** `green-*` in 14 files
- **error:** `red-*` (76) **and** `rose-*` (2)
- **strays:** `teal-*` (3), `orange-*` (2)

Two greens sitting next to each other in the same result view is the single most visible
"nobody owns this" signal in the app.

Note: **`amber` is not purely decorative.** In `admin/*` and `dashboard/subscription/*` it
carries the *pending / warning* meaning. It gets kept as a semantic token and removed only
where it is decoration (landing badges, hero orbs).

### 1.4 Weight collapse

| weight | uses |
|---|---|
| `font-black` (900) | 374 |
| `font-bold` (700) | 175 |
| `font-medium` (500) | 35 |
| `font-semibold` (600) | 17 |

Card titles, table headers, nav links, `10px` captions and h1 all render at 900. There is no
hierarchy left to read — everything is emphasis, so nothing is.

### 1.5 Radius and shadow chaos

Radii: `rounded-2xl` ×236, `rounded-xl` ×86, `rounded-full` ×84, `rounded-3xl` ×64,
`rounded-[2rem]` ×34 (arbitrary, 14 files), `rounded-lg` ×23, `rounded-md` ×1.

Shadows: ~25 distinct combinations, tinted five different ways
(`shadow-blue-200`, `shadow-indigo-200/50`, `shadow-emerald-100`, `shadow-teal-200`,
`shadow-slate-200/70`, …). Light direction is inconsistent between the landing and the app.

### 1.6 Explicit AI-aesthetic markers to delete

| marker | location |
|---|---|
| `gradient-hero` + `noise-overlay` | `app/page.tsx:74` |
| blurred colour orbs `blur-3xl` ×4 | `app/page.tsx:77,78,243,244` |
| `blur-2xl` orbs | `app/page.tsx:189`, `app/dashboard/page.tsx:94` |
| `gradient-text` ×3 | `app/page.tsx:92,172,215` |
| `gradient-cta` ×6 | `app/page.tsx:104,226,296,316`, `Navbar.tsx:41,70,113` |
| `bg-gradient-to-tr` avatar | `components/layout/ShellUser.tsx:39` |
| `bg-gradient-to-r` divider | `app/page.tsx:223` |
| `bg-gradient-to-b` panel | `components/exam/SplitScreen.tsx:268` |
| `glass` / `glass-dark` | `app/page.tsx:145,152,261` |
| `backdrop-blur-md` score card | `app/dashboard/results/[id]/page.tsx:101` |
| `backdrop-blur-sm` modal scrim | `components/exam/ReferenceModal.tsx:116` |
| `Sparkles` / `Zap` icon badges | `app/page.tsx:84,279` |
| gradient sheen on every button | `globals.css:246` (`.btn-primary::after`) |

`gradient-warm` in `globals.css:171` is dead — nothing references it.

**Bonus:** removing `blur-3xl` orbs and `backdrop-filter` is also a performance win. Both
force continuous compositor work; `globals.css:133` already documents that `backdrop-filter`
was deliberately dropped from the frosted panels for exactly this reason, and then two
`backdrop-blur-*` usages crept back in.

---

## 2. Target system

Written into `globals.css` as tokens, then consumed everywhere.

**Colour**

```
accent          blue-600   #2563eb    primary actions, active nav, links
accent-hover    blue-700   #1d4ed8
accent-subtle   blue-50    #eff6ff    tinted backgrounds, icon chips
neutral         slate-*               the only gray family (already true: 982 usages)
success         emerald-600           correct answers, active subscription, approved payment
warning         amber-600             pending payment, expiring access
danger          red-600               wrong answers, validation errors, destructive
```

`green-*`, `rose-*`, `teal-*`, `orange-*`, and decorative `indigo-*`/`amber-*` are removed.

**Weight scale**

```
font-black     display h1/h2 on the landing, and big numeric metrics only
font-semibold  section headings, card titles, table headers, buttons
font-medium    nav links, labels, badges, emphasised body
font-normal    body copy, captions, descriptions
```

`font-bold` is retired as an ambiguous middle step; existing uses map to `semibold` or
`medium`.

**Radius scale**

```
rounded-lg   (8px)   inputs, badges, small chips
rounded-xl   (12px)  buttons, list rows, inner elements
rounded-2xl  (16px)  cards, panels, modals
rounded-full         avatars, pills, progress tracks
```

`rounded-3xl` and `rounded-[2rem]` are removed — the container radius should be *softer than*
inner elements, not four sizes deep.

**Elevation**

```
flat      border border-slate-200                          default for cards
raised    border border-slate-200 shadow-sm                lifted cards, dropdowns
overlay   shadow-lg shadow-slate-900/10                    modals, popovers
```

One light source, top-down, neutral slate tint. No coloured shadows.

---

## 3. Steps

Each step is one commit, independently reviewable and revertable. Run
`npm run lint` and `npm run build` after each.

### Step 1 — Rewrite the token layer in `globals.css`

Single file, no component changes yet.

1. `--accent-primary: #4f46e5` → `#2563eb`; drop `--accent-secondary` as a *decorative*
   accent and re-add amber as `--color-warning`.
2. Add `--color-success`, `--color-warning`, `--color-danger` to the `@theme inline` block.
3. Delete `.gradient-text`, `.gradient-hero`, `.gradient-cta`, `.gradient-warm`
   (`globals.css:150-173`) and the whole `NOISE TEXTURE OVERLAY` block (`:175-187`).
4. Delete `.glass` and `.glass-dark` (`:140-148`); replace with plain
   `bg-white border border-slate-200` and `bg-slate-800 border border-slate-700`.
5. Delete the gradient sheen `.btn-primary::after` (`:246-253`). Keep the
   `::before` opacity-animated shadow — it is a correct, compositor-friendly hover, but
   retint from `rgba(79,70,229,0.4)` (indigo) to blue.
6. Retint `.card-hover::after` (`:208`) from `rgba(79,70,229,0.12)` to a neutral slate.
7. Retint `::selection` (`:258-261`) off indigo.

**Keep** the animation keyframes, the `prefers-reduced-motion` block, and the perf comments —
they are load-bearing and documented.

*Verify:* `/` and `/dashboard` still render; gradients disappear; no console errors.

### Step 2 — De-slop the landing (`app/page.tsx`, `components/layout/Navbar.tsx`)

The single highest-impact change; ~2 files, self-contained.

- Hero (`:74-78`): drop `gradient-hero noise-overlay` and both orb divs. Use a flat
  `bg-white` with a `border-b border-slate-200` separating it from the features section.
- `gradient-text` spans (`:92,172,215`): flat `text-blue-600`.
- `gradient-cta` buttons (`:104,226,296,316` + `Navbar.tsx:41,70,113`): `bg-blue-600
  hover:bg-blue-700`.
- `glass` floating cards (`:145,152`): `bg-white border border-slate-200 shadow-sm`.
- Feature-card hover orb (`:188-190`): delete the whole clipping wrapper; the
  `.card-hover` translate already carries the interaction.
- Feature `accent` colours (`:22,28,34,40`): the four-colour icon set
  (indigo/amber/emerald/rose) becomes one `bg-blue-50 text-blue-600`. Differentiation comes
  from the icon, not from four hues.
- Step connector (`:223`): `bg-gradient-to-r from-slate-200 via-indigo-200 to-slate-200`
  → `bg-slate-200`.
- Dark stats section (`:242-274`): keep the dark band (it is a deliberate rhythm break, not
  an accident) but drop `noise-overlay` and both orbs, and swap `glass-dark` for
  `bg-slate-800 border border-slate-700`.
- `Sparkles` (`:84`) and `Zap` (`:279`) badge icons: replace with the plain text label. These
  two icons are the most literal "written by AI" tell on the page.
- Radii: `rounded-3xl` → `rounded-2xl`, `rounded-2xl` buttons → `rounded-xl`.

*Verify:* screenshot `/` at desktop + mobile; confirm hero image still lazy-loads with the
`sizes="(min-width: 1024px) 40vw, 1px"` guard intact.

### Step 3 — Remaining gradient / blur usages outside the landing

Four small edits:

- `components/layout/ShellUser.tsx:39` — avatar `bg-gradient-to-tr from-blue-600
  to-indigo-600` → `bg-blue-600`.
- `app/dashboard/page.tsx:94` — delete the `blur-2xl` orb div.
- `app/dashboard/results/[id]/page.tsx:101` — score card `bg-white/10 backdrop-blur-md
  border-white/20` → `bg-slate-800 border border-slate-700`.
- `components/exam/ReferenceModal.tsx:116` — drop `backdrop-blur-sm`, raise the scrim from
  `bg-slate-950/55` to `bg-slate-950/70` to compensate.
- `components/exam/SplitScreen.tsx:268` — `bg-gradient-to-b from-blue-50 to-white` →
  `bg-blue-50`, and the hand-rolled `shadow-[0_18px_40px_rgba(59,130,246,0.12)]` →
  `shadow-sm`.

*Verify:* run one exam end-to-end — the reference modal, the split-screen panel, and the
results header are all on the critical path.

### Step 4 — Collapse the duplicate semantic colours

Mechanical, but touches ~25 files. Do success and error as two separate commits.

1. **`green-*` → `emerald-*`** across the 14 files listed in §1.3. Same numeric stop
   (`green-600` → `emerald-600`). Emerald wins because it reads better against slate.
2. **`rose-*` → `red-*`**, **`teal-*` → `emerald-*`**, **`orange-*` → `amber-*`**.
3. **Decorative `indigo-*` → `blue-*`** in the 18 files that carry it. Leave `amber-*` where
   it means *pending/warning* (admin payment queues, subscription expiry) — check each hit
   rather than sed-replacing.

*Verify:* the exam review page (`app/exam/review/[resultId]/page.tsx`) and the results page
render correct/incorrect answers in exactly two colours.

### Step 5 — Apply the weight scale

374 `font-black` → a real hierarchy. Order by file size, largest first
(`TestList.tsx` 727, `SectionAccessManager.tsx` 679, `AdminForm.tsx` 556 …).

Rules to apply per occurrence:

- landing `h1`/`h2`, and numeric metrics ≥ `text-3xl` → keep `font-black`
- everything else currently `font-black` → `font-semibold`
- current `font-bold` on labels, badges, nav links, captions → `font-medium`
- current `font-bold` on headings and buttons → `font-semibold`
- `text-[10px]` / `text-xs` captions → `font-medium` at most

Also add `tabular-nums` to the score, timer, and count displays — they currently jitter as
digits change.

*Verify:* visual diff of `/dashboard`, `/admin`, and an exam session. This step changes the
most pixels; screenshot before and after.

### Step 6 — Normalise radius and elevation

- `rounded-[2rem]` (34 uses, 14 files) → `rounded-2xl`.
- `rounded-3xl` (64 uses) → `rounded-2xl`.
- Coloured shadows (`shadow-blue-200`, `shadow-emerald-100`, `shadow-teal-200`,
  `shadow-indigo-*`) → the three-step elevation scale from §2.
- The three hand-written `shadow-[0_...]` arbitrary values → `shadow-sm` / `shadow-lg`.

*Verify:* `npm run build`, then walk every route.

### Step 7 — Make the token layer real

Prevents the drift from coming back.

**Done differently from the plan above.** The plan proposed adding `bg-accent` /
`bg-success` / … utilities and converting a subset of call sites. That was dropped after
looking at what it would actually buy:

- Converting only *some* call sites leaves two vocabularies for the same colour — a worse
  version of the §1.2 problem, not a fix.
- Converting *all* of them is not possible: components legitimately use many stops
  (`blue-50`, `blue-100`, `blue-400`, `blue-600`, `blue-700`), and inventing a token per
  stop just renames Tailwind's scale without adding meaning.
- Declaring tokens that nothing consumes is exactly how the old `--accent-primary: #4f46e5`
  ended up pointing at a colour the app had stopped using.

So instead:

- The unused token vocabulary (`--color-accent`, `--color-surface`, `--color-success`, …)
  was **removed**. `globals.css` keeps only `--background`, `--foreground` and `--accent` —
  the three values CSS itself needs.
- Those three are now genuinely consumed: `.btn-primary` and `.card-hover` tint their
  shadows from them via `color-mix()`, and so does `::selection`. Changing `--accent`
  visibly moves those.
- Components keep using Tailwind's scale directly, and the contract for *which* part of
  that scale is allowed is written down in `AGENTS.md` → "Design system". That document is
  the anti-drift mechanism, not the token layer.

---

## Outcome

All seven steps applied. 47 files, +841 / −861.

| | before | after |
|---|---|---|
| colour families | 10 (slate, blue, red, emerald, green, amber, indigo, teal, rose, orange) | **5** (slate, blue, emerald, red, amber) |
| font weights | black 374 · bold 175 · medium 35 · semibold 17 | **semibold 290 · medium 268 · black 33** |
| radii | 2xl · xl · full · 3xl · `[2rem]` · lg · md · `[1.5rem]` | **2xl · xl · full · lg** |
| shadows | ~25 combinations, 5 different tints | **sm · lg · 2xl**, untinted |
| gradients / blur / glass / noise | 13 sites | **0** |

`font-black` survives in 33 places, all of them `text-3xl`+ display headings or large
numeric metrics. The two arbitrary upward shadows on the sticky bottom bars are kept
deliberately — Tailwind has no utility for a shadow cast upward.

Verified: ESLint clean, `tsc --noEmit` clean, `next build` green across all 29 routes, and
the rendered landing page reports zero gradient / `backdrop-filter` / blur layers.

**Not verified visually:** every route behind authentication — the dashboard, the exam
runner and the results pages. The changes there are type-safe and purely presentational,
but a full exam attempt should be walked before this ships, with attention to the grid-in
answer panel and the reference sheet (step 3).

---

## 4. What is deliberately *not* done

- No font swap. `Plus_Jakarta_Sans` is fine and already wired through
  `--font-jakarta`; swapping it would churn every line-height in the app for no clear gain.
- No layout restructuring. The three-column feature row and the card grids stay — the brief
  is style unification, not an information-architecture change.
- No dark mode. Nothing in the codebase currently supports it; adding it here would triple
  the surface area of every step above.
- The `redesign-existing-projects` skill recommends *adding* noise overlays, mesh gradients,
  and "true glassmorphism". That directly contradicts the brief, so those recommendations are
  ignored. Its typography, spacing, state, and content guidance is applied.

---

## 5. Risk and effort

| Step | Files | Risk | Note |
|---|---|---|---|
| 1 tokens | 1 | low | CSS only, instantly revertable |
| 2 landing | 2 | low | isolated from app routes |
| 3 gradients/blur | 5 | **medium** | touches the exam critical path |
| 4 semantic colours | ~25 | low | mechanical, but review each `amber` |
| 5 weight scale | ~45 | low | mechanical, highest pixel churn |
| 6 radius/elevation | ~30 | low | mechanical |
| 7 tokenisation | ~10 | medium | refactor, not a visual change |

The only step that can break behaviour is **3** — `ReferenceModal` and `SplitScreen` are
inside the exam runner. Test a full exam attempt before merging it.
