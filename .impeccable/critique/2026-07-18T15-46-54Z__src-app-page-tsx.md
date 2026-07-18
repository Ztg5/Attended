---
target: the dashboard (src/app/page.tsx)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-07-18T15-46-54Z
slug: src-app-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Global `loading.tsx` is a bare centered spinner; product register calls for skeletons, not a spinner where content will be |
| 2 | Match System / Real World | 4 | Fluent sports-desk language — W–L records, "Biggest blowout", league acronyms, "Games you both attended" |
| 3 | User Control and Freedom | 3 | BackLink everywhere, delete confirms, dismissible prompt — but no undo after a game delete |
| 4 | Consistency and Standards | 3 | One button vocabulary + shared PageMasthead/SectionHeader; but the record tile's cobalt tint contradicts "accent = interactive chrome only" |
| 5 | Error Prevention | 3 | Delete confirmation, numeric/date constraints, duplicate guard on log |
| 6 | Recognition Rather Than Recall | 3 | Sign-out is icon-only with only a `title`; profile label hides below `sm` |
| 7 | Flexibility and Efficiency | 3 | Filter/search/sort, bulk season add via /schedule, manage mode — no keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Much improved after the de-slop pass; still a vertical stack of same-shaped bordered boxes |
| 9 | Error Recovery | 2 | Sign-in failure is generic ("Something went wrong signing in"); little diagnosis anywhere |
| 10 | Help and Documentation | 2 | No help surface; empty states teach only partially |
| **Total** | | **29/40** | **Good — solid foundation, address weak areas** |

## Anti-Patterns Verdict

**LLM assessment**: This no longer reads as AI-generated. The two passes removed the decisive tells — the uppercase-tracked eyebrow on every heading, the decorative icon layer, and the explainer sentence under every title. The nameplate + ledger rule is a real authored signature, and the sans/mono/serif mapping is a genuine system rather than a default.

What still reads generic is **shape uniformity**: nearly every container is `rounded-lg border border-border bg-surface`, so the dashboard is a vertical stack of four visually identical boxes. Nothing on the page is shaped differently because it *means* something different.

The larger miss is **identity, not slop**: DESIGN.md's central thesis is "near-neutral chrome so every saturated color carries data meaning — team color is a data channel." The dashboard uses **zero team color**. Team rows show a logo and neutral numerals; the record is neutral. The one saturated accent on the page (cobalt on the record tile) is the app accent, not data. The product's stated signature is absent from its flagship screen.

**Deterministic scan**: `detect.mjs --json src/app src/components` → `[]`, exit 0. Zero findings — no gradient text, side-stripe borders, glassmorphism, or eyebrow patterns. Clean, and consistent with my own read. No false positives to flag. Worth noting the detector is regex-based and structurally blind to the reflexes that actually made this feel generated (icon-on-everything, subtitle-on-everything) — those were caught by eye, not by scan.

**Visual overlays**: Not available, and no overlay was injected. Two concrete blockers: (1) the browser pane's screenshot API times out at 30s on every tab and every retry this session; (2) the critique target is auth-gated behind Google OAuth — unauthenticated requests to `/` redirect to `/sign-in`, and authenticating isn't something I can do. Findings above are from source review plus computed-style probes via JS evaluation on the one reachable page.

## Overall Impression

The chrome is now genuinely well-built — consistent components, honest states, a real typographic system, and a masthead with a point of view. The problem is that it's a **stats command center that shows almost no data personality**. Six neutral numerals in six neutral cells, then three neutral boxes. The single biggest opportunity is to let the data itself carry color and shape: team color on team rows, win/loss weight in the record, and a form that varies with meaning instead of one rounded rectangle repeated.

## What's Working

- **The type system earns its keep.** Mono tabular numerals for every score/record genuinely reads like a scoreboard, and reserving Newsreader for personal notes makes the memory layer feel different in kind from the metrics. That's a real mapping, not decoration.
- **`GameRow` expand-in-place** is the right affordance: the log stays dense and scannable, and detail (venue, note, attendance, box-score link) appears without a navigation or a modal. Progressive disclosure done properly.
- **`/schedule` bulk add** is a genuinely thoughtful power feature — checking off a team's season beats logging 40 games one at a time, and it respects the real way someone backfills a history.

## Priority Issues

**[P1] New users land on a dead dashboard**
- *Why it matters*: With zero games, the record reads `0–0`, every stat is `0`, and "Recent games" renders an **empty bordered box** — a rectangle with nothing in it. This is the first screen after onboarding, and it teaches nothing about what the app does. "By team" is the only section with a real empty state.
- *Fix*: Give the zero-state its own composition — replace the stat strip and empty rows with a single direct invitation to log a first game (or import a season via `/schedule`), and suppress sections that have no data rather than rendering empty chrome.
- *Suggested command*: `/impeccable onboard`

**[P1] Sign-out is an unlabeled icon button**
- *Why it matters*: `UserMenu` renders a `LogOut` glyph whose only accessible name is a `title` attribute — unreliable for screen readers and invisible to a first-timer. The adjacent profile link also collapses to icon-only below the `sm` breakpoint. Two of the three account controls are unlabeled on a phone.
- *Fix*: Add `aria-label` to both controls, and keep a visible text label for sign-out (or move both into a labeled menu).
- *Suggested command*: `/impeccable audit`

**[P2] The primary action is outside the thumb zone on mobile**
- *Why it matters*: PRODUCT.md commits to "One-handed truth — thumb-reachable logging, sticky primary action." In practice "Log a game" sits top-right in a masthead that wraps to 6–8 controls on a phone, pushing actual content down and putting the core action at the top of the screen. The stated principle and the built screen disagree.
- *Fix*: Give mobile a sticky bottom-anchored "Log a game" affordance and collapse the secondary nav (Collection / Players / People) behind one control.
- *Suggested command*: `/impeccable adapt`

**[P2] Team color — the system's stated signature — is unused**
- *Why it matters*: The whole palette strategy exists so saturated color can mean something. On the dashboard nothing uses it, so the page reads as a neutral admin panel and the "By team" rows are visually interchangeable. The collection checklist carries the entire color idea alone.
- *Fix*: Apply team color as a data channel on the dashboard — team rows and record emphasis — honoring DESIGN.md's contrast guard (L ≤ 0.62 to hold white text, otherwise keyline + ink text), never as a fill behind a whole section.
- *Suggested command*: `/impeccable colorize`

**[P2] The record tile's tint inverts its own affordance**
- *Why it matters*: Five of the six stat cells link somewhere; the record cell is the *only* one that doesn't — and it's the only one given a cobalt `--primary-weak` background. Since cobalt is defined as interactive chrome, the one unclickable tile is the one that looks most clickable. Users will tap it.
- *Fix*: Carry the anchor's emphasis with typographic weight/scale (and a rule) rather than the interactive accent, or make the record cell link to a record breakdown so the affordance is honest.
- *Suggested command*: `/impeccable polish`

## Persona Red Flags

**Sam (Accessibility-Dependent)**: The sign-out button announces only via `title` — likely read as "button" alone by some screen readers. Below `sm`, the profile link is a bare `UserRound` glyph with no text. Global `loading.tsx` uses `role="status"` correctly, and focus rings are properly defined — but win/loss on the dashboard is carried by **font weight alone** (`font-semibold` on the winner in `GameLine`/`GameRow`), which is not a reliable non-color cue and contradicts PRODUCT.md's own "never by color alone, pair with glyph or label" rule.

**Casey (Distracted Mobile)**: Lands on a masthead of 6–8 controls that wraps into multiple rows before any content appears. The primary "Log a game" is top-right, unreachable one-handed — the exact scenario PRODUCT.md names (logging at the stadium, on stadium wifi). Tap targets are adequate (`h-9`/`h-11` buttons, `touch-action: manipulation` is set), and the instant `loading.tsx` feedback is a real win on a slow connection.

**Alex (Power User)**: No keyboard shortcuts anywhere — no `/` to search the log, no `n` to log a game. The records carousel is arrow-click only, so reaching a fourth league's records takes repeated clicks with no direct jump. `/schedule` bulk add is the one strong efficiency feature and it's excellent; it deserves to be discoverable from the dashboard rather than only inside `/log`.

## Minor Observations

- The stat strip label sizes (`text-[11px]`) sit below the type scale documented in DESIGN.md (stat label = `0.8125rem`); the doc and the code have drifted.
- `Stat` still accepts an `icon` prop that no caller passes now — dead API surface.
- The `Section` helper in `page.tsx` still threads a `hint` prop that is no longer used by any caller.
- DESIGN.md's preamble still advertises "a fully designed dark mode," but `globals.css` is light-only and says so. Stale doc.
- The per-league counts line under the stat strip has no label at all now — it reads as four bare "NFL 23" pairs with no framing.
- `/games` empty state ("No games here yet.") is honest but doesn't differ between "no games logged ever" and "no games match this filter," which are very different situations.

## Questions to Consider

- If team color is the product's stated data channel, what would the dashboard look like if the **record** were the one thing colored by the team it belongs to?
- The record is described as the headline number, but it currently occupies 1/6 of a strip. What would a version look like where the record is unmistakably the hero and the other five are secondary readouts?
- Every container is the same rounded rectangle. Which of these four sections actually deserves a *different* shape — and what would that say about its meaning?
- What does this screen look like for someone with three games logged, rather than sixty?
