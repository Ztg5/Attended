/**
 * One-time import: read seed-games.csv, run each row through the matching logic,
 * print a per-row summary, and (unless --dry-run) persist everything to Postgres.
 *
 *   npm run import:dry     # match against ESPN, print summary, NO database writes
 *   npm run import         # full import into Postgres (seeds leagues/teams first)
 *   npm run import -- --no-enrich   # skip the per-game summary-endpoint enrichment
 *
 * The full import clears the Game table first so re-runs stay idempotent.
 */
import path from "node:path";
import { readSeedGames } from "../src/lib/csv";
import { buildTeamResolver, TeamResolver } from "../src/lib/espn/teams";
import { matchRow, MatchResult } from "../src/lib/matching";
import { fetchSummary, LeagueCode } from "../src/lib/espn/client";

const DRY_RUN = process.argv.includes("--dry-run");
const ENRICH = !process.argv.includes("--no-enrich");
const CSV_PATH = path.resolve(process.cwd(), "seed-games.csv");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- pretty printing --------------------------------------------------------

const TAG: Record<MatchResult["category"], string> = {
  clean: "✔ CLEAN    ",
  corrected: "✎ CORRECTED",
  needs_review: "⚑ REVIEW   ",
};

function nick(resolver: TeamResolver, league: LeagueCode, espnId: string | null): string {
  if (!espnId) return "?";
  return resolver.byEspnId(league, espnId)?.nickname ?? espnId;
}

function scoreLine(resolver: TeamResolver, r: MatchResult): string {
  if (!r.event) return "no match";
  const home = nick(resolver, r.row.league, r.homeTeamEspnId);
  const away = nick(resolver, r.row.league, r.awayTeamEspnId);
  const venue = r.venue?.name ? ` @ ${r.venue.name}` : "";
  const otLabel = r.row.league === "MLB" ? "extra innings" : "OT";
  const flags = [
    r.isPostseason ? (r.postseasonRound ? `PLAYOFF:${r.postseasonRound}` : "PLAYOFF") : "",
    r.wentToOvertime ? otLabel : "",
    r.attendance ? `att ${r.attendance.toLocaleString()}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `${away} ${r.awayScore ?? "?"} @ ${home} ${r.homeScore ?? "?"}${venue}${
    flags ? ` [${flags}]` : ""
  }`;
}

function printRow(resolver: TeamResolver, i: number, r: MatchResult) {
  const idx = String(i + 1).padStart(2, "0");
  const date = r.matchedDate ?? r.row.date ?? "??????????";
  const head = `[${idx}] ${TAG[r.category]} ${r.row.league.padEnd(3)} ${date}  ${r.row.homeTeam} vs ${r.row.awayTeam}`;
  console.log(head);
  console.log(`        -> ${scoreLine(resolver, r)}`);
  for (const reason of r.reasons) console.log(`         . ${reason}`);
}

// --- persistence ------------------------------------------------------------

async function persist(results: MatchResult[], resolver: TeamResolver) {
  // Lazy-load DB modules only when actually writing, so a dry run needs no DB.
  const { prisma } = await import("../src/lib/db");
  const { seedLeaguesAndTeams } = await import("./seed-espn");

  console.log("\nSeeding leagues & teams from ESPN...");
  const seeded = await seedLeaguesAndTeams(resolver);
  console.log(`  ${seeded.leagues} leagues, ${seeded.teams} teams.`);

  // Maps for FK resolution.
  const leagues = await prisma.league.findMany();
  const leagueIdByCode = new Map(leagues.map((l) => [l.code as LeagueCode, l.id]));
  const teams = await prisma.team.findMany();
  const teamIdByKey = new Map(teams.map((t) => [`${t.leagueId}:${t.espnTeamId}`, t.id]));

  console.log("Clearing existing games for a clean import...");
  await prisma.game.deleteMany({});

  // Multi-user: notes belong to a user's Attendance, not the Game. If OWNER_EMAIL is
  // set, the owner gets an Attendance row (carrying the CSV note) for every game.
  const ownerEmail = process.env.OWNER_EMAIL?.trim() || null;
  let ownerId: string | null = null;
  if (ownerEmail) {
    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      create: { email: ownerEmail },
      update: {},
      select: { id: true },
    });
    ownerId = owner.id;
    console.log(`Attaching attendance to owner <${ownerEmail}>.`);
  } else {
    console.log("OWNER_EMAIL not set — seeding global games only (no attendance/notes).");
  }

  let written = 0;
  for (const r of results) {
    const leagueId = leagueIdByCode.get(r.row.league)!;
    const homeTeamId = r.homeTeamEspnId
      ? teamIdByKey.get(`${leagueId}:${r.homeTeamEspnId}`) ?? null
      : null;
    const awayTeamId = r.awayTeamEspnId
      ? teamIdByKey.get(`${leagueId}:${r.awayTeamEspnId}`) ?? null
      : null;

    // Venue (keyed by ESPN venue id).
    let venueId: number | null = null;
    if (r.venue?.espnVenueId) {
      const v = await prisma.venue.upsert({
        where: { espnVenueId: r.venue.espnVenueId },
        create: {
          espnVenueId: r.venue.espnVenueId,
          name: r.venue.name ?? "Unknown venue",
          city: r.venue.city,
          state: r.venue.state,
        },
        update: { name: r.venue.name ?? undefined, city: r.venue.city, state: r.venue.state },
      });
      venueId = v.id;
    }

    // Optional enrichment from the summary endpoint.
    let details: unknown = r.event?.details ?? null;
    if (ENRICH && r.event) {
      try {
        const summary = await fetchSummary(r.row.league, r.event.espnEventId);
        details = { scoreboard: r.event.details, summary };
        await sleep(120); // be gentle with ESPN
      } catch {
        /* enrichment is best-effort; keep scoreboard details */
      }
    }

    // Store the LOCAL game date (the scoreboard bucket ESPN filed it under), not the
    // UTC datetime — a 7:30pm ET tip has a UTC date of the next day, which would
    // mis-date every night game by +1. matchedDate is that local calendar date.
    const dateOnly =
      r.matchedDate ??
      r.row.date ??
      (r.event?.dateIso ? r.event.dateIso.slice(0, 10) : new Date().toISOString().slice(0, 10));

    const game = await prisma.game.create({
      data: {
        leagueId,
        date: new Date(`${dateOnly}T00:00:00Z`),
        seasonYear: r.seasonYear,
        homeTeamId,
        awayTeamId,
        venueId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        status: r.status,
        espnEventId: r.event?.espnEventId ?? null,
        isPostseason: r.isPostseason,
        postseasonRound: r.postseasonRound,
        wentToOvertime: r.wentToOvertime,
        attendance: r.attendance,
        detailsJson: details as any,
        claimedResult: r.row.claimedResult,
        matchNote: r.reasons.join(" | ") || null,
      },
    });

    if (ownerId) {
      await prisma.attendance.create({
        data: { userId: ownerId, gameId: game.id, notes: r.row.notes },
      });
    }
    written++;
  }

  await prisma.$disconnect();
  return written;
}

// --- main -------------------------------------------------------------------

async function main() {
  console.log(`Attended import ${DRY_RUN ? "(DRY RUN — no database writes)" : "(FULL — writing to Postgres)"}`);
  console.log(`CSV: ${CSV_PATH}\n`);

  const rows = readSeedGames(CSV_PATH);
  console.log(`Read ${rows.length} rows. Loading ESPN team directory...`);
  const resolver = await buildTeamResolver();

  const results: MatchResult[] = [];
  for (const row of rows) {
    results.push(await matchRow(row, resolver));
  }

  console.log("\n============================ MATCH SUMMARY ============================\n");
  results.forEach((r, i) => printRow(resolver, i, r));

  const clean = results.filter((r) => r.category === "clean").length;
  const corrected = results.filter((r) => r.category === "corrected").length;
  const review = results.filter((r) => r.category === "needs_review").length;

  console.log("\n----------------------------------------------------------------------");
  console.log(
    `TOTAL ${results.length}   |   ✔ clean ${clean}   ✎ corrected ${corrected}   ⚑ needs_review ${review}`
  );
  console.log("----------------------------------------------------------------------");

  if (review > 0) {
    console.log("\nNeeds review:");
    results.forEach((r, i) => {
      if (r.category === "needs_review") {
        console.log(`  [${String(i + 1).padStart(2, "0")}] ${r.row.league} ${r.matchedDate ?? r.row.date ?? "no-date"} ${r.row.homeTeam} vs ${r.row.awayTeam} — ${r.reasons.join("; ")}`);
      }
    });
  }

  if (DRY_RUN) {
    console.log("\nDry run complete. No database writes. Re-run without --dry-run to persist.");
    return;
  }

  const written = await persist(results, resolver);
  console.log(`\nWrote ${written} games to Postgres.`);
}

main().catch((err) => {
  console.error("\nImport failed:", err);
  process.exit(1);
});
