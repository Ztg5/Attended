# Attended

Personal, single-user web app tracking every professional sporting event the owner has
attended. Auto-fetches results/venues from ESPN's undocumented public API and gamifies
the history (records, team-logo checklists, stadium map). No auth (obscure URL). See
`attended-project-plan.md` (in `../../Documents/attended/`) for the full plan.

## Stack

Next.js (App Router) + TypeScript · Prisma + Postgres (Neon) · Tailwind · Lucide.
Node 22. Fonts via `next/font/google` (self-hosted).

## Commands

```bash
npm run dev            # dev server (localhost:3000)
npm run import:dry     # match seed-games.csv against ESPN, print summary, NO db writes
npm run import         # full import into Postgres (clears + rewrites the Game table)
npm run db:push        # push prisma/schema.prisma to the database
npx tsx --env-file=.env scripts/verify.ts   # sanity-check persisted data
```

Env: `.env` holds Neon `DATABASE_URL` (pooled) + `DIRECT_URL` (non-pooled, for migrations).

## Architecture

- `src/lib/espn/client.ts` — the ONLY place that talks to ESPN. Endpoint changes are a
  one-file fix. All calls are best-effort; failures degrade to `needs_review`, never crash.
- `src/lib/espn/teams.ts` — nickname → ESPN team resolver (handles Cavs, Niners, etc.).
- `src/lib/matching.ts` — shared match logic (±1-day fuzzy, dateless resolution via team
  schedule, claimed-result cross-check). Used by the import and the review re-run.
- `scripts/import-games.ts` — one-time CSV import; prints matched/corrected/needs_review.
- `src/app/review/` — UI to resolve flagged games (server actions: re-run / save / mark).
- Derived stats (records, teams seen, venues) are **computed in queries, never stored**.

Data model: League · Team (stores ESPN id, colors, logo_url) · Venue (keyed by ESPN venue
id — one venue despite name changes) · Game. Prisma schema is the source of truth.

## Phase status

- **Phase 1 (Foundation) — DONE.** Schema, ESPN client, seeding, import (66/66 games
  verified in Postgres), review screen.
- **Phase 3 (Dashboard) — DONE.** Headline stats + personal records + followed-team
  records on `/`; filterable/searchable game log on `/games`. Derived stats in
  `src/lib/stats.ts`. Game dates stored as the LOCAL scoreboard date (not UTC) so night
  games aren't +1.
- **Phase 2 (Logging) — DONE.** `/log` match-and-confirm form (searchable team pickers,
  ESPN preview, duplicate guard, save as final/pending/needs_review); pending-game
  refresh on the dashboard; edit/delete on existing games via manage mode on `/games`.
  Actions in `src/app/log/actions.ts`.
- **Phase 4 (Collection) — DONE.** `/collection`: per-league team-logo checklists
  (seen full-color / unseen grayscale, with counts) + a US stadium map (d3-geo +
  us-atlas, server-rendered SVG, pins sized by games / colored by home team) + a stadium
  list. Queries in `src/lib/collection.ts`. Venue coords curated in
  `scripts/backfill-venue-coords.ts` (ESPN exposes no lat/long).

All four phases complete. Routes: `/` dashboard · `/games` log · `/log` add · `/review`
· `/collection`.

## Design Context

Design is defined in two root files — **read them before any UI work**:

- **[PRODUCT.md](PRODUCT.md)** — strategy. Register: **product**. Personality: a **stats
  command center** with a sports-desk voice (precise, authoritative, personal). Anti-refs:
  generic AI-SaaS (gradients, glassmorphism, identical card grids, badge soup),
  team-color wallpaper. Principles: numbers carry authority; team color is a data channel
  not decoration; collection is a feeling; the memory survives the metric; one-handed truth.
- **[DESIGN.md](DESIGN.md)** — visual system (Google Stitch format). Key rules:
  - **Near-neutral chrome so every saturated color carries meaning.** App accent is cobalt
    `oklch(0.541 0.122 248)`, used only for interactive chrome; team/semantic colors are a
    separate data layer. OKLCH tokens live in `globals.css`.
  - **Type mapped to meaning:** Geist Sans = UI, Geist **Mono** = all scores/stats
    (`.tnum`, tabular), Newsreader **serif** = personal notes (`.note`). Never buried.
  - **Real ESPN team logos are core to the feel** — show them wherever a team is named;
    the checklist is logos going grayscale→color. Render via `next/image` + `TeamLogo`.
  - Light-first, first-class dark mode (`data-theme` on `:root`). Tables over cards.
    A11y: win/loss & seen/unseen never by color alone (paired with glyph/label); WCAG AA.
