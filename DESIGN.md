# Design

Visual system for **Attended** — a personal stats command center for every pro
sporting event attended. Register: **product**. Light-first, with a fully designed dark
mode. The guiding idea: **the interface is near-neutral so that every saturated color
carries data meaning** — a team, a result, a milestone. Color is a channel, not decor.

Reference DNA: **Letterboxd** (personal log, collection grids, per-entry notes) +
**The Athletic / FiveThirtyEight** (editorial sports data-viz, confident figures,
restrained palette). Feel: **precise, authoritative, personal.**

---

## Theme

- **Strategy:** Restrained. Neutral architecture (bg / surface / ink) + a single system
  accent ≤10% of the surface. Team, league, and semantic colors form a separate,
  data-driven layer on top of the neutral base.
- **Default:** light. Dark mode is a first-class alternate (toggled, `data-theme` on
  `:root`, respects `prefers-color-scheme`).
- **Color space:** OKLCH throughout.

### Color tokens

```css
:root {
  /* --- Architecture (near-neutral, faint cool cast) --- */
  --bg:        oklch(1 0 0);              /* pure white */
  --surface:   oklch(0.968 0.003 255);   /* cards, panels, table headers */
  --surface-2: oklch(0.945 0.004 255);   /* insets, hover rows */
  --border:    oklch(0.90 0.005 255);    /* hairlines, dividers */
  --ink:       oklch(0.22 0.02 255);     /* body text — ~14:1 on bg */
  --muted:     oklch(0.48 0.015 255);    /* secondary text — ~5:1 on bg */
  --faint:     oklch(0.62 0.012 255);    /* tertiary / disabled labels */

  /* --- System accent (interactive chrome only: links, focus, primary btn, active nav) --- */
  --primary:      oklch(0.541 0.122 248);   /* cobalt */
  --primary-hover:oklch(0.492 0.126 248);
  --primary-weak: oklch(0.951 0.020 248);   /* tinted bg for selected/active */
  --on-primary:   oklch(0.99 0 0);          /* white text on primary fill */

  /* --- Milestone accent (records, personal bests, "collection complete") — sparingly --- */
  --gold:      oklch(0.82 0.13 85);
  --on-gold:   oklch(0.26 0.03 85);         /* dark text on gold */

  /* --- Semantic result colors (ALWAYS paired with icon/label, never color alone) --- */
  --win:       oklch(0.56 0.14 150);    --on-win:  oklch(0.99 0 0);
  --loss:      oklch(0.55 0.19 27);     --on-loss: oklch(0.99 0 0);
  --live:      oklch(0.72 0.16 65);     --on-live: oklch(0.26 0.04 65); /* pending/in-progress */
  --review:    oklch(0.60 0.03 285);    /* needs_review — muted, leads with ⚑ icon */

  --focus:     var(--primary);          /* focus ring color */
  --radius:    6px;                     /* precise, not pill-everything */
  --radius-lg: 10px;
}

:root[data-theme="dark"] {
  --bg:        oklch(0.17 0.008 255);   /* slate-black, not pure black — long reads, lets team color pop */
  --surface:   oklch(0.215 0.010 255);
  --surface-2: oklch(0.255 0.011 255);
  --border:    oklch(0.30 0.012 255);
  --ink:       oklch(0.95 0.005 255);
  --muted:     oklch(0.70 0.012 255);
  --faint:     oklch(0.56 0.012 255);

  --primary:      oklch(0.70 0.13 248);  /* lightened to read on dark */
  --primary-hover:oklch(0.76 0.13 248);
  --primary-weak: oklch(0.28 0.05 248);
  --on-primary:   oklch(0.16 0.02 255);  /* dark text on the lighter primary */

  --gold:      oklch(0.80 0.13 85);      --on-gold: oklch(0.22 0.03 85);
  --win:       oklch(0.66 0.14 150);
  --loss:      oklch(0.64 0.19 27);
  --live:      oklch(0.76 0.15 65);      --on-live: oklch(0.20 0.04 65);
  --review:    oklch(0.68 0.03 285);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* mirror the dark block for no-JS default */ }
}
```

Contrast targets: `--ink` ≥ 7:1 on `--bg`, `--muted` ≥ 4.5:1, filled buttons/badges use
white text on saturated mid fills (Helmholtz-Kohlrausch), dark text only on `--gold` and
other pale (L>0.85) fills. **Validate with the audit pass once real screens exist.**

### Data-color rules (the layer that carries meaning)

- **Team color** — stored per team (`primary_color` from ESPN). Used for: team chips,
  checklist "seen" fills, map pins, and a single keyline/accent on a game's detail. Never
  a full page/section background.
  - *Contrast guard:* when a team color backs white text, only use it if its OKLCH L ≤
    0.62; otherwise render the team color as a **left keyline + text in `--ink`** on a
    neutral surface, or darken toward the team's own hue until it holds white text. Some
    teams share hues (Bills/Titans blue, many reds) — disambiguate with the logo, never
    hue alone.
- **Seen / unseen (collection):** seen = team color at full saturation + subtle ring;
  unseen = `--surface-2` fill, `--faint` logo at ~35% opacity. Reads at a glance; also
  distinguished by opacity/label, not color alone.
- **League** stays neutral by default; if wayfinding needs it, a small monochrome league
  glyph, not a league-colored surface.

---

## Typography

Type is mapped to meaning: **sans = UI, mono = data, serif = memory.** This is the
system's signature and satisfies the contrast-axis pairing rule (proportional sans vs
mono vs serif — never two similar sans).

```css
:root {
  --font-sans:  "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:  "Geist Mono", ui-monospace, "SF Mono", "Cascadia Code", monospace;
  --font-serif: "Newsreader", ui-serif, Georgia, "Times New Roman", serif;
}
```

- **Geist Sans** — all UI: nav, labels, headings, controls, table text. Weights 400/500/
  600/700. Headings tight: `letter-spacing: -0.02em`, `text-wrap: balance` on h1–h3.
- **Geist Mono** — the command-center voice: **all scores, big stat numerals, streak
  counts, W/L records, dates in tables.** Always `font-variant-numeric: tabular-nums`.
  This is what makes figures line up and read like a scoreboard/terminal readout.
- **Newsreader (serif) = the writer's voice.** Primary home is **personal game notes**
  (`.note`, the memories). Extended — deliberately — to **section standfirsts / hints**
  (`.standfirst`, italic) and short editorial asides ("Games by league —", "Also attended
  by"). Same voice, whether it's the beat writer narrating a section or you narrating a
  game. Never used for UI chrome, labels, controls, or data. `text-wrap: pretty` for prose.
- Body line length capped 65–75ch. Display/hero numerals may go large but headings
  `clamp()` max ≤ 5rem. No gradient text, ever.

### Type scale (fluid where useful)

| Role | Family | Size / weight |
|---|---|---|
| Hero record numeral | mono | `clamp(2.5rem, 6vw, 4.5rem)` / 600, tabular |
| Page title | sans | 1.75rem / 700 / -0.02em |
| Section title | sans | 1.125rem / 600 |
| Stat value | mono | 1.5rem / 600 / tabular |
| Stat label | sans | 0.8125rem / 500 / `--muted`, `letter-spacing: 0.01em` |
| Table cell | sans (num cols mono) | 0.875rem / 400 |
| Body / note | serif | 1rem / 400 / 1.6 line-height |

---

## Spacing & Layout

- **Base unit 4px.** Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Vary spacing for rhythm;
  don't uniformly pad everything.
- **Tables over cards.** The game log, records, and standings are dense tabular data —
  render as real tables with aligned tabular numerals, zebra hover (`--surface-2`), sticky
  headers. Reserve cards for genuinely card-shaped things (a single game detail, a
  headline stat). **No identical card grids; never nest cards.**
- Content max-width ~1100px for dashboard; tables can go full-width with horizontal scroll
  inside their own `overflow-x:auto` container on mobile.
- Responsive collection grids: `repeat(auto-fit, minmax(72px, 1fr))` for logo checklists;
  no breakpoint soup. Flexbox for 1D rows, Grid for the 2D checklist/map.
- **Mobile-first logging:** the log-a-game form and its controls sit in the thumb zone;
  large tap targets (≥44px), sticky primary action.
- **z-index scale (semantic):** `--z-dropdown:10; --z-sticky:20; --z-backdrop:30;
  --z-modal:40; --z-toast:50; --z-tooltip:60`. Never 999.

## Elevation & borders

- Light mode leans on **hairline borders** (`--border`) and surface steps, not shadows.
  One soft shadow reserved for overlays/modals: `0 8px 24px oklch(0.22 0.02 255 / 0.12)`.
- Dark mode uses surface lightness steps for elevation; shadows are nearly invisible on
  dark, so separate with `--border` and `--surface-2`.
- **Bans (from PRODUCT.md):** no gradients, no glassmorphism, no side-stripe accent
  borders >1px, no hero-metric gradient template, no eyebrow kickers on every section.

## Imagery — team logos (core to the feel)

**Real team logos are the primary imagery of the app and are non-negotiable.** They are
what make it feel like a sports product rather than a spreadsheet — every team already
has a real ESPN `logo_url` in the database. Treat logos as a first-class design element,
not an afterthought:

- **Everywhere a team is named, show its logo** — game rows, the matchup header, team
  chips, records, the checklist, the map's list view, game detail.
- **The collection mechanic IS logos.** The team checklist is a wall of real logos that
  light from grayscale → full color as they're "collected." That transformation is the
  single most important visual moment in the app; design it to feel satisfying.
- **Rendering:** crisp, square-ish bounding box, `object-fit: contain`, transparent
  background (ESPN logos are transparent PNGs), never stretched. Sizes 20 / 28 / 40
  / 64. On busy surfaces give a subtle neutral ring or `--surface` plate so varied logos
  sit on a common ground. Provide `alt` text (team name) — logos are content, not decor.
- **Seen vs unseen:** seen = full-color logo; unseen = the same logo desaturated
  (`filter: grayscale(1)`) at ~30–40% opacity. Distinguished by saturation AND opacity,
  so it never depends on color perception alone.
- ESPN serves a dark-variant logo (`.../500-dark/...`) — prefer it in dark mode where the
  default logo would disappear on the slate background.
- Serve via `next/image` (remote host `a.espncdn.com` is already allow-listed) so they're
  optimized and lazy-loaded; the collection grid can be dozens of logos at once.

## Iconography

- **Lucide** (already a dependency), 1.5px stroke, sized to the type (16/20/24). Icons
  reinforce meaning that color also carries (▲ win, ▼ loss, ⚑ needs-review, ● live) so
  nothing is color-only. Icons are the system's glyph layer; **team logos are the
  imagery layer** (see above) — the two do different jobs.

## Motion

Purposeful and restrained — a command center, not a toy. Every animation has a
`@media (prefers-reduced-motion: reduce)` fallback (crossfade or instant).

- **Curves:** ease-out-quint / expo only. No bounce, no elastic. Durations 150–400ms.
- **Hero records:** count-up on load (reduced-motion → final value instantly).
- **Collection grid:** subtle staggered fade/scale as logos resolve; stagger fits the
  list, not a uniform reflex. Content is visible by default — reveals enhance, never gate.
- **Map pins:** drop/scale-in on first view; hover lifts the pin, not the whole card.
- **State changes** (pending → final on refresh): a brief highlight flash on the updated
  row, then settle.

---

## The signature layer (almanac / box-score voice)

The bones are neutral; personality comes from an editorial layer that makes the app read
as a **beat-writer's box-score almanac** rather than a generic dashboard. Three parts,
all in `globals.css` (`@layer components`):

- **Nameplate** (`.nameplate`) — the publication title. Geist Sans **800**,
  `letter-spacing: -0.035em`, ~2–2.75rem. Every page opens with one (via `PageMasthead`);
  the dashboard and sign-in set it largest. Reads as a sports-section front page, not an
  app header.
- **Ledger rule** (`.rule-ledger`) — the app's signature divider: a 2px `--ink` hairline
  over a 1px `--border` hairline with a gap between (the newspaper / box-score double
  rule). Sits under every masthead. Used sparingly — it's the one loud line on the page.
- **Editorial section header** (`.section-head` + `SectionHeader`) — replaces the old
  `uppercase tracking-wide text-muted` eyebrow (which had metastasized onto every section
  and read as pure AI grammar). Title Case label in `--ink`, an optional serif-italic
  `.standfirst`, and a hairline `--border` rule that runs out to the row's action.
  **No uppercase-tracked eyebrows.** Acronym labels (league codes: NFL, MLB) and dense
  data-table column headers stay uppercase — those are data, not eyebrows.

Reusable pieces: `PageMasthead` (nameplate + standfirst + ledger rule), `SectionHeader`
(the editorial header). Use them instead of hand-rolling a bold `h1` or a muted-caps `h2`.

## Component patterns

- **Headline stat** — mono numeral + sans label; the dashboard band is a **scoreboard
  strip** (hairline-separated readouts), with the record leading as the tinted anchor
  cell. Not the gradient hero-metric cliché, and not six identical SaaS stat cards: flat,
  tabular, one cell weighted, the rest linking out.
- **Game row** — date (mono) · matchup (sans, team chips) · score (mono, winner
  emphasized) · venue · a note indicator (serif snippet on expand). Expands in place to
  reveal the full serif note, line score, and details.
- **Result badge** — icon + short label + team/semantic color. `W`/`L` always carry the
  glyph and the record color, never color alone.
- **Team chip** — logo + abbreviation; team color as a thin ring or the abbreviation
  color on neutral, per the contrast guard.
- **Checklist cell** — team logo in a square; seen = full color + ring + subtle count
  badge; unseen = faint grayscale. The grid shows "18 / 32 seen" as a mono fraction.
- **Needs-review item** — leads with the ⚑ glyph and `--review` color, editable fields,
  a re-run-match action; calm, not alarming (these are expected, not errors).
- **Empty states** — honest and specific ("No NHL games yet — you haven't been to one")
  rather than decorative blanks.

## Accessibility (recap from PRODUCT.md)

WCAG AA contrast; seen/unseen and win/loss never by color alone; full keyboard
operability with a visible `--focus` ring; real reduced-motion paths. Validate contrast
and focus order with `/impeccable audit` once screens are built.
