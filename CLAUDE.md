# Attended

Multi-user web app tracking every professional sporting event a user has attended.
**Games are global** (one shared row per real-world game); each user's attendance +
private notes live in `Attendance`. Auto-fetches results/venues from ESPN's undocumented
public API and gamifies the history (records, team-logo checklists, stadium map), all
scoped to the signed-in user. See `attended-project-plan.md` (in `../../Documents/attended/`).

## Stack

Next.js (App Router) + TypeScript · Prisma + Postgres (Neon) · Tailwind · Lucide ·
**Auth.js (NextAuth v5) with Google + Prisma adapter**. Node 22. Fonts via
`next/font/google` (self-hosted).

## Auth & scoping

- **Auth.js v5**, Google provider, **JWT sessions** (so edge middleware authorizes with
  no DB round-trip) + **Prisma adapter** (so `User`/`Account` persist in Postgres).
- Config is split for edge-safety: `src/auth.config.ts` (edge-safe: providers + the
  `authorized` route-gate callback, imported by `src/middleware.ts`) and `src/auth.ts`
  (Node: adapter + the invite gate / jwt / session callbacks, uses Prisma).
- **Open sign-up.** Any Google account can sign in (no invite code). The Google OAuth
  consent screen is published (Production), so it's not limited to test users.
  `allowDangerousEmailAccountLinking` links a pre-created row (e.g. the migrated owner)
  to Google by email (safe: Google verifies the email).
- `src/middleware.ts` gates every route except `/sign-in`, `/api/auth/*`, and static.
- `requireUserId()` in `src/lib/session.ts` gives pages/actions the user id **and
  enforces a username** (redirects to `/choose-username` if unset). `getSessionUser()`
  is the non-enforcing variant used by `/choose-username` itself. **Every** read query
  (stats, collection, players, game log) filters games through the user's `Attendance`
  rows; player tables stay global but "seen"/totals filter through attended games. Notes
  are read from the user's `Attendance`, never from `Game`.

## Social (friends)

- **Username** (`User.username`, unique) chosen on first sign-in at `/choose-username`
  (editable later via the user menu). `requireUserId()` gates the app on it.
- **Friend graph** is request/approve (`Friendship`: `requester`→`addressee`, status
  `pending`/`accepted`, one row per pair). Read queries in `src/lib/social.ts`; mutations
  (send/accept/decline/cancel/remove) in `src/app/people/actions.ts`.
- `/people` — search users by username/name, incoming requests inbox, friends list.
- `/u/[username]` — a profile. Non-friends see only name + a request button. Friends
  (and self) see games/record/venues, up to **4 favorite games**, a collection preview,
  and a "you both attended N games" link → `/u/[username]/shared` (shared list + combined
  record). **Another user's private notes are never selected** (`BASE_GAME_SELECT` in
  `stats.ts` omits notes; social queries use it).
- **Favorites**: `Attendance.favoritedAt` (non-null = favorite), capped at 4 in
  `toggleFavorite` (`src/app/log/actions.ts`); the star toggle is on the game detail page.

## Commands

```bash
npm run dev                    # dev server (localhost:3000)
npm run import:dry             # match seed-games.csv against ESPN, print summary, NO writes
npm run import                 # full import into Postgres (clears + rewrites the Game table)
npm run db:push                # push prisma/schema.prisma to the database
npm run backfill:summaries -- --missing-only   # fetch ESPN box-score summaries into details_json
npm run backfill:players       # parse players from stored details_json (no ESPN calls)
npx tsx --env-file=.env scripts/backfill-venue-coords.ts   # set venue lat/long from the curated table
npx tsx --env-file=.env scripts/verify.ts                  # sanity-check persisted data
npm run migrate:multiuser -- --backup                      # snapshot Game.notes → notes-backup.json
npm run migrate:multiuser -- --email you@gmail.com         # create owner + Attendance for every game
```

Env: `.env` holds Neon `DATABASE_URL` (pooled) + `DIRECT_URL` (non-pooled, for migrations),
plus `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (see `.env.example`).
`OWNER_EMAIL` is only used by the one-time migration / CSV import.

## Single-user → multi-user migration (ordered)

Notes move off `Game` onto `Attendance`, so the schema change straddles a `db push`.
Run in this order (idempotent + reversible; see `scripts/migrate-multiuser.ts`):

1. `npm install`
2. `npm run migrate:multiuser -- --backup` — snapshots current `Game.notes` to
   `notes-backup.json` (gitignored) **before** the column is dropped.
3. `npm run db:push` — creates `User`/`Account`/`Session`/`VerificationToken`/`Attendance`
   and drops `Game.notes`.
4. `npm run migrate:multiuser -- --email you@gmail.com` — upserts the owner `User` and a
   per-game `Attendance` carrying each note from the backup.

Reverse: `npm run migrate:multiuser -- --revert --email you@gmail.com` (add `--delete-user`
to also drop the owner row); `--restore-notes` copies the backup back onto `Game.notes`
(after re-adding the column).

## Deployment

Live on **Vercel**, auto-deploys on push to `main` (GitHub `Ztg5/Attended`). Set
`DATABASE_URL` + `DIRECT_URL` + `AUTH_SECRET` + `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`
in Vercel env vars. The Google OAuth client's authorized redirect URI must
include `https://<domain>/api/auth/callback/google`. Pages that read the DB are
`export const dynamic = "force-dynamic"` so builds never depend on the DB being reachable.
`next.config.mjs` sets `images.unoptimized: true` — all images are already-optimized ESPN
CDN assets, so this keeps Vercel Image-Optimization transformations at zero.

## Architecture

- `src/lib/espn/client.ts` — the ONLY place that talks to ESPN. Endpoint changes are a
  one-file fix. All calls are best-effort; failures degrade to `needs_review`, never crash.
- `src/lib/espn/teams.ts` — nickname → ESPN team resolver (handles Cavs, Niners, etc.).
- `src/lib/matching.ts` — shared match logic (±1-day fuzzy, dateless resolution via team
  schedule, claimed-result cross-check). Used by the import and the review re-run.
- `scripts/import-games.ts` — one-time CSV import; prints matched/corrected/needs_review.
- `src/app/review/` — UI to resolve flagged games (server actions: re-run / save / mark).
- `src/lib/stats.ts` — dashboard stats. **Favorite teams are per-user**
  (`User.favoriteTeams`, chosen at onboarding via `/choose-teams`, editable from the
  dashboard "By team" section). `getFollowedTeamIds(userId)` drives records/streaks; a
  friend's profile record uses **their** favorite teams, not the viewer's.
- `src/lib/summary.ts` — parses stored `details_json.summary` into box scores
  (`parseSummary`) and box-score players (`parseBoxscorePlayers`, infers NFL position from
  stat category since ESPN omits it). Never fetches.
- `src/lib/players.ts` — player sync (`syncGamePlayers`) + lean read queries. Player/game
  list queries **never select `details_json`** (egress rules); only the one-time backfills
  and the game-detail box score read it.
- `src/lib/venue-coords.ts` — curated venue lat/long (ESPN has none), matched by name.
  Wired into the log flow so newly-logged stadiums get a map pin automatically.
- Derived stats (records, teams seen, venues) are **computed in queries, never stored**.

Data model: **User** (+ `username`) · **Account/Session/VerificationToken** (Auth.js) ·
**Friendship** (request/approve friend graph) · League · Team (ESPN id, colors, logo_url) ·
Venue (keyed by ESPN venue id) · Game (global, shared) · **Attendance** (user↔game, private
`notes`, `favoritedAt`, unique on `[userId, gameId]`) · **Player** (deduped on ESPN player id) ·
**GamePlayer** (player↔game, team + free-form numeric `stats` JSON). Prisma schema is the
source of truth. Logging dedupes on `espnEventId`: if the global Game already exists, it
only creates the user's `Attendance` (no re-fetch).

## Phase status

- **Phase 1 (Foundation) — DONE.** Schema, ESPN client, seeding, import (66/66 games
  verified in Postgres), review screen.
- **Phase 3 (Dashboard) — DONE.** Headline stats + personal records + followed-team
  records on `/`; filterable/searchable game log on `/games`. Derived stats in
  `src/lib/stats.ts`. Game dates stored as the LOCAL scoreboard date (not UTC) so night
  games aren't +1.
- **Phase 2 (Logging) — DONE.** `/log` match-and-confirm form (**home team + date only** —
  ESPN resolves the opponent; `awayTeam` is optional in `matching.ts`), ESPN preview,
  duplicate guard, save as final/pending/needs_review; pending-game
  refresh on the dashboard; edit/delete on existing games via manage mode on `/games`.
  Actions in `src/app/log/actions.ts`.
- **Phase 4 (Collection) — DONE.** `/collection`: per-league team-logo checklists
  (seen full-color / unseen grayscale, with counts) + a US stadium map (d3-geo +
  us-atlas, server-rendered SVG, pins sized by games / colored by home team) + a stadium
  list. Queries in `src/lib/collection.ts`. Venue coords curated in
  `scripts/backfill-venue-coords.ts` (ESPN exposes no lat/long).

All four phases complete, plus post-plan features:

- **Game detail** (`/games/[id]`) — line score, team stats, game leaders (renders only
  sections present in the data), and a "Who you saw" player list. Parser in `summary.ts`.
- **Player tracking** — `/players` (searchable/sortable grid, filter by league then position,
  headshots, times-seen) and `/players/[id]` (games seen, career totals excluding rate/max
  stats, team record, "stats available for X of Y" note). Log flow extracts players
  automatically; `scripts/backfill-players.ts` backfilled the rest from `details_json`.
- **Deployed** to Vercel (see Deployment above). OKLCH color tokens have an `@supports`
  hex fallback in `globals.css` for older browsers.

Routes: `/` dashboard · `/games` log · `/games/[id]` box score · `/log` add · `/review`
· `/collection` · `/players` · `/players/[id]` · `/people` · `/u/[username]` (profile) ·
`/u/[username]/shared` (mutual games) · `/choose-username` · `/choose-teams` · `/sign-in`.

Game detail intentionally omits the per-game **team stats** table (too heavy at scale);
the player detail per-game list shows only a **headline stat set** per league
(`headlineStats` in `src/lib/players.ts`), not every box-score field.

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
  - **Light mode only** (dark theme was removed; `globals.css` has no dark tokens and
    `color-scheme: light`). Tables over cards.
    A11y: win/loss & seen/unseen never by color alone (paired with glyph/label); WCAG AA.
