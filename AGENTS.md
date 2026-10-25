<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system

Tailwind v4, configured entirely in `src/app/globals.css` (`@theme`) — there
is no `tailwind.config.js`. Components use colour scales directly
(`bg-board-600`, `text-mist-500`); there is no parallel token vocabulary
(`bg-accent`, `text-muted`), on purpose. An earlier one drifted out of sync with
the classes actually in use and nothing caught it.

The look is a calm, compact product UI — the kind of professional tool a
student opens every day, not a landing page. These scales are the whole
system. Reaching outside them is drift — if a design genuinely needs a sixth
colour or another radius, change this file in the same commit.

**Build screens from `src/components/ui/`, not from raw class strings.**
`Page` / `PageHeader` / `BackLink` / `SectionHeading` (Page.tsx), `Card` /
`CardHeader` / `CardBody` / `CardFooter` / `cardClass` / `insetClass`
(Card.tsx), `Button` / `IconButton` / `buttonClass()` for links that look like
buttons / `linkClass` for links in text (Button.tsx),
`Input` / `Select` / `Textarea` / `Field` / `checkboxClass` (Field.tsx),
`Badge` (Badge.tsx), `PaymentStatusBadge` (the one payment status → tone
map), `StatGroup` + `Stat` (Stat.tsx), `List` + `RowText` +
`listRowClass` + `rowChevronClass` and the `th`/`td` table classes (List.tsx),
`Alert` / `EmptyState` / `Skeleton` (Feedback.tsx), `Avatar` /
`iconCircleClass` / `segmentedClass` + `segmentClass()` /
`chipGroupClass` + `chipClass()` + `ChipCheck` / `KeyValue` / `Progress` (Misc.tsx),
`ConfirmDialog` / `useConfirm` for a question, `Dialog` for a form or a
task (Dialog.tsx) — never `window.confirm()` or `alert()`. A caller's `className`
adds layout only (margin, width, grid placement) — there is no tailwind-merge,
so a second colour or padding would fight the primitive's own. Dates go through
`formatDate` / `formatDateTime` (`src/lib/formatDate.ts`): English, Tashkent
time — never a bare `toLocaleDateString()`.

**Colour — five families, no more. The palette is "Board".**

| role | class | means |
|---|---|---|
| accent | `board-600` / `board-700` hover and text on subtle / `board-50` subtle | primary action, active nav, selected item, links |
| neutral | `mist-*` | everything structural |
| success | `lime-700` (`lime-800` on `lime-50`) | correct answer, active subscription, approved payment, a score that went up |
| warning | `amber-600` (`amber-800` on `amber-50`) | **pending / expiring / flagged only** — never "look here" emphasis |
| danger | `red-600` | wrong answer, validation error, destructive action |

`board` is the one scale that is not Tailwind's own: no Tailwind hue is the
deep classroom-board green the owner chose, so it is defined in `globals.css`
as a full 50–950 scale and used exactly like the built-in ones. The owner
picked it on 2026-10-25 from the three palettes of the from-scratch plan (Ink,
Graphite, Board) and asked for it everywhere, the sidebar included; it replaced
indigo, which had replaced blue. `mist` is Tailwind's cool grey with a trace of
green, the plan's Board neutrals almost exactly. Success moved from emerald to
`lime` with it: a green accent beside a green "correct" would make a selected
answer and a right answer look alike, so the two greens are kept apart by hue
(blue-green against yellow-green) and every status also carries an icon and a
word.

No `slate`, `indigo`, `emerald`, `blue`, `sky`, `green`, `teal`, `rose`,
`orange`, `violet`. Lime never means "selected" and amber never means
"premium" or "first place". Do not colour a row of cards or stat tiles in
rotating hues — one accent treatment, and let the icon and label carry the
difference. There is one primary button colour, `board-600`; dark `mist-900`
buttons are out. The one exception is the exam screen's question-number tile
and its "Question N of M" navigator pill: they copy Bluebook, the app students
sit the real test in.

**Canvas.** The app shell's page ground is `bg-mist-100`; cards are white on
it. The desktop sidebar is the one brand surface — deep board green
`bg-board-950` (so the `board-600` buttons stay the brightest accent on
screen), labels `board-100`, icons `board-200`, hover `board-900`, the
active socket `board-600`, keyboard focus a white outline
(`sidebarFocusClass`), a hovered row lit `board-900` in the active tab's own
shape, `w-56` open and an 80px rail collapsed, with the collapse toggle a small
keyed circle on its right edge, level with the logo, in both states — and
its active tab is drawn in the canvas colour (see `ShellNav`), so a page inside
the shell must not paint its own full-height background. Nowhere else is board a surface colour, with
one exception: the logo tile (`BrandMark`) is `bg-board-600` with a white mark on
light pages and white with a board mark on the sidebar — a mark, not a surface.
The browser-tab icon (`src/app/icon.svg`, `apple-icon.png`) and the link
preview (`opengraph-image.tsx`) draw the same mark in the same green.

The auth pages (sign-in, sign-up, email confirmation, password reset) share
`AuthShell`: the landing's header line over one narrow column held to the top —
not centred vertically, so an error never moves the form.

**Type — Fira Sans, compact.** The face is Fira Sans in three weights, 400,
500 and 600 (`next/font/google` in `src/app/layout.tsx`, `--font-fira-sans`
behind `--font-sans` in `globals.css`). It replaced Inter on 2026-10-25, the
owner's choice from the plan: it covers Russian, Uzbek Cyrillic (Ққ Ғғ Ҳҳ Ўў)
and the Uzbek ʻ in oʻ and gʻ, was drawn for small screens and stays legible
at 12–14px, has tabular figures, and does not read as the default face of a
generated SaaS. Maths stays in KaTeX's serif.

Body copy is `text-sm`. Page title `text-xl sm:text-2xl
font-semibold tracking-tight` (PageHeader) · section and card titles
`text-base font-semibold` · row titles `text-sm font-medium` · meta and captions
`text-xs text-mist-500` on white, `text-mist-600` on any tinted ground — the
`mist-100` canvas, `mist-50` inset panels and table headers (page
descriptions, back links: mist-500 there is about 4.1–4.4:1, under AA) ·
stat values `text-xl sm:text-2xl font-semibold
tabular-nums` · the one score headline on a result page `text-4xl sm:text-5xl
font-semibold tabular-nums tracking-tight` with a `text-lg font-medium
text-mist-500` "/ 800" — the only number larger than a page title. Maths is set
in KaTeX's fonts; their names carry underscores (`KaTeX_Main`), which Tailwind's
arbitrary values turn into spaces, so they live in CSS, never in
`[font-family:…]`. Nothing below `text-xs` except the mobile tab labels
(`text-[11px]`). Sentence case everywhere; no uppercase letter-spaced
"eyebrow" captions above titles. The exam's question and answer text keep
their reading size — compactness is taken from the chrome around them.

**Weight — three steps.** `font-bold` and `font-black` are retired, and Fira
Sans is loaded only in 400, 500 and 600.

- `font-semibold` — headings, card titles, stat values
- `font-medium` — buttons, nav links, labels, badges, row titles
- (unset) — body copy and descriptions

Numeric values that change in place (scores, timers, counts) get `tabular-nums`.

**Size — fixed control heights.** Buttons and inputs `h-9` (`md`), `h-8` in
toolbars and rows (`sm`), `h-10` on the auth forms and single CTAs (`lg`). On a
coarse pointer (phones) the primitives step up by themselves — buttons `sm`
`h-10`, `md`/`lg` `h-11`, inputs `h-11`, segmented items `h-9`, chips `h-10` —
so callers add no `max-sm:h-*` of their own. Height comes from `h-*`, never
from `py-*`. Card padding `p-5` (`p-4` for dense
tiles), card header `px-5 py-4`, list rows `px-4 sm:px-5 py-3`, table cells
`px-4 py-3`. Page container `max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8`,
sections `space-y-6`, card grids `gap-4`. One level of padding — never a padded
card inside a padded card; nest with `insetClass` or `divide-y`. A grid that
gets its columns at a breakpoint starts from `grid-cols-1`: without a template
the implicit track is `auto` and grows to its longest unbroken line (a
`truncate` row pushed the Practice cards past the edge of a phone).

**Controls — pressable before hover.** Everything you can press must look
pressable before it is hovered — the owner's note was "the buttons look like
plain text" — so buttons are drawn like keys:

- `primary` (and `danger`): a solid fill with a darker inner edge along the
  bottom;
- `secondary`: white, a `mist-400` box whose bottom edge is `mist-500`, over
  `shadow-xs` — a key standing on the page; pressing removes the edge;
- `quiet`: white, a light `mist-300` box and a `board-700` label, for a
  low-priority action that repeats in rows and toolbars ("Extend 1 month",
  "Copy email");
- `ghost`: only in toolbars where the surrounding chrome already says
  "controls";
- `danger-secondary`: a destructive action repeated down a list — keyed like
  secondary, red only on hover and focus, never a column of red bins.

A link inside text or a meta line is `linkClass`: `board-700` and always
underlined, so it is told from plain text without colour and without hover.
Every pressable row ends in a chevron.

Text inputs: `border-mist-400` (cards keep `mist-200`), hover `mist-500`,
placeholder `mist-500`, focus `border-board-600` + `ring-1 ring-board-600`
(`fieldFocusClass`), error `aria-invalid:border-red-600`. A `Field` with
`htmlFor` wires its hint or error to the control with `aria-describedby`. A
button that cannot act yet is drawn from the palette — `disabled:bg-mist-200
disabled:text-mist-500` on the solid variants — never `opacity-50`, which
turned the accent into an off-palette pastel; say why next to it where the
reason is not obvious. Keyboard focus on buttons is `focusRingClass` (2px
`outline-board-600`); text fields use `focus:outline-hidden`, never
`outline-none`, so Windows high-contrast mode still shows where the focus is.

**Status and filters never share a shape.** A status `Badge` is flat — no
border, `rounded-md`, a tinted ground — and a success, warning or danger badge
leads with its icon (the primitive adds it), so a status is never colour
alone. A filter or picker with more than four options is a row of chips
(`chipClass`): a pill with a `mist-400` edge; the chosen one is `board-50`
with a `board-600` edge and leads with `<ChipCheck active />`. A segmented
control is for two to four options and must not wrap onto a second line.

**Empty states** sit where the content will be, at its size: `EmptyState`, a
dashed panel with one icon, a one-line title, at most one sentence and one
real button. Never a paragraph, sample numbers or a page of centred grey text.

**Radius — five steps.** `rounded-md` items inside a control (segmented
items) and status badges · `rounded-lg` buttons, inputs, icon buttons ·
`rounded-xl` inner elements (inset panels, alerts, answer rows) · `rounded-2xl`
cards, panels, popovers and modals · `rounded-full` avatars, filter chips,
progress bars and the sidebar's active tab. No `rounded-3xl`, no bare
`rounded`, no arbitrary `rounded-[2rem]`.

**Elevation — three steps, one light source, never tinted.** `border-mist-200`
alone for a card (the default — cards are flat) · `shadow-lg` for dropdowns and
popovers · `shadow-2xl` for modals. On controls only the key edges above:
`shadow-xs` under a secondary button and the primary's inset bottom edge
(Button.tsx), plus `shadow-sm` on the selected segment of a segmented control.
Coloured shadows (`shadow-board-200`, `shadow-lime-100`, …) are out — the
default neutral shadow is the single light source. The two arbitrary upward
shadows on the sticky bottom bars are deliberate: Tailwind has no utility for a
shadow cast upward.

**Lists are lists.** A collection of records is one card with `divide-y` rows
(`List`) or a table — not a stack of separate bordered cards. Cards are for
objects with their own actions (a test in the catalog, a plan).

**Icons — lucide, one treatment per role.** `h-4 w-4` unless a primitive sizes
them.

- Entry icon — a card that is a link, a short list of places, an empty
  state: `text-board-600` in a `bg-board-50` circle, `h-9 w-9` circle, 18px icon,
  via `iconCircleClass` (Misc.tsx). It is the calm version of the sidebar's
  active socket. The same green on every card — never a hue per card.
- Icon in a button: the button's own text colour, no circle, no colour class.
- Status icon (lock, warning, not included): `mist-500` or the status
  colour, no circle.
- Long lists and tables: no icons in the rows — a column of thirty circles is
  noise.
- Row and card chevrons: `mist-400`, `mist-600` on hover, via
  `rowChevronClass` (List.tsx). Never `mist-300`: 1.5:1 on white, and gone.
- An icon inside an input (the search glass) is `mist-400`: an icon, not
  text, so it is not held to the placeholder's `mist-500`.

**Motion.** `transition-colors` on hover. No hover lifts, scale or rotate, no
entrance animations on page content. The one exception is the public landing
(`src/components/landing/`), where the motion *is* the demo: it lives in
`landing.module.css`, animates only transform, opacity and stroke offset,
pauses off screen and has a `prefers-reduced-motion` version. Keep it there.

**Not in this codebase:** gradients, `backdrop-filter`, noise or grain overlays,
blurred colour "orbs" or decorative blobs, glassmorphism, dark "hero" banners,
coloured icon squares or a different hue per card (the one icon treatment is
under Icons). They were removed on purpose — they read
as generated, and the blur layers kept the compositor busy for the whole
session. `globals.css` and `AppShellFrame.tsx` carry comments explaining the
performance half; do not reintroduce them.

# Words

The UI is English; the voice is plain, short and calm — no exclamation marks,
no "Oops", no praise, no filler ("unlock", "journey", "seamless", "smart").
Second person to students ("your answers"). Admin copy is terser and names the
data ("37 results", "until 14 Dec"). Sentence case for titles, buttons, tabs,
menu items and table headers.

| say | not |
|---|---|
| course | section, category, collection |
| test | exam, quiz, mock |
| result | submission |
| Flag, flagged | mark for review, bookmark |
| not answered | skipped, unanswered |
| test code | access code |
| confirmation code | OTP |
| give access | grant |
| ranking | leaderboard |

A button names what the press does — a verb and an object: "Start test",
"Review 14 mistakes", "Give access to 20 emails", "Remove access"; never "OK",
"Submit" alone or "Click here". Numbers are numerals ("1 question", "0
attempts left"); ranges take an en dash with no spaces ("550–620"); a fall
takes a real minus ("−20"). Errors say what happened, what is safe and what to
do, next to their cause; never "Something went wrong" alone or a status code.

Say where things are and how they are counted, once, where it matters:
"Saved on this device" for an attempt in progress, "Times are Tashkent time"
beside an olympiad window, the rule under a ranking.

# Product rules the owner set

- **No explanations for students.** A question's explanation is not shown
  in a result or a review; the admin editor keeps the field.
- **No prices** on plan cards, the landing or anywhere else; the amount
  appears only in the manual payment form while sales are open.
- **Review is one question at a time** (`revealResultQuestion`), with
  switching between questions — never every answer on one page, which a
  student could print.
- **A test has one or more modules.** Many are two modules, each with its own
  timer; some are one block (30 questions, one timer). Every screen — catalog,
  start, exam, Check your work, result, admin — must read right for both.

# Admin

Admins have no hub page: their places sit in the sidebar, seen by admins only —
Courses, Users, Question bank, Board. What waits for a decision (payments,
access about to end, hidden imports, the olympiad) is one bell button with a
count beside the Courses page's actions, opening a popover — not a card that
pushes the table down. The question bank opens on a search card, as the
College Board's educator bank does: domain and difficulty tiles (a checkbox
in a bordered tile, each with its count; difficulty drawn as three bars, the
`DifficultyBars` of `bankBadges.tsx`), words to find, and Search. Nothing is
listed before that; results are a table with numbered pages. The Board's
bank tab and the build page's question picker use the same search card
(`choiceTileClass`, `DifficultyBars`) and list only after Search. A course page has the tabs Students
(the default), Tests, Results and Settings; access is given from one Give
access dialog (emails pasted or found by search, a course, 1, 2 or 3 months,
a preview before anything is saved; access only ever extends). Payment
requests are reviewed on the Subscription page. Tests are added to a course by
importing a `.tex` file or by building one from the question bank; both put
the questions in the bank (`BankQuestion`), tagged by domain and difficulty
(`src/lib/questionBank.ts`).

A test keeps its own `Question` rows: a bank-backed row is a copy of the bank
text with `bankQuestionId`, so the exam, grading, review and stats read
questions as they always did. An edit on either side is written through to
the bank and to every row linked to it (`src/lib/questionBankServer.ts`), and
the exam caches of those tests and their copies are expired. Deleting a test
never deletes bank questions; deleting a bank question only unlinks the rows.
A storage image is removed only when no `BankQuestion` and no `Question`
still uses it — bank uploads live under `bank/<uuid>/` in the question-image
bucket, and orphan-cleanup scripts must count both tables as references.

In a `.tex` file each `\begin{question} … \end{question}` block may carry
`\domain{…}` (the value, the College Board name or a short alias: `algebra`,
`advanced-math` / `am`, `problem-solving` / `psda`, `geometry-trig` / `trig`)
and `\difficulty{1|2|3}` (or `easy` / `medium` / `hard`). A question without
them is tagged in the import preview before anything is saved.
