/**
 * Backfill detailsJson.summary for every game with an espn_event_id by fetching the
 * ESPN event summary (line score, team stats, leaders, etc.). Best-effort and
 * idempotent — a failed fetch leaves the game untouched.
 *
 *   npx tsx --env-file=.env scripts/backfill-summaries.ts                 # (re)fetch all
 *   npx tsx --env-file=.env scripts/backfill-summaries.ts --missing-only  # only where absent
 */
import { prisma } from "../src/lib/db";
import { fetchSummary, LeagueCode } from "../src/lib/espn/client";

const MISSING_ONLY = process.argv.includes("--missing-only");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const games = await prisma.game.findMany({
    where: { espnEventId: { not: null } },
    include: { league: true },
    orderBy: { date: "asc" },
  });
  console.log(`${games.length} games with an ESPN event id${MISSING_ONLY ? " (missing-only mode)" : ""}.`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const g of games) {
    const existing = g.detailsJson as any;
    if (MISSING_ONLY && existing?.summary) {
      skipped++;
      continue;
    }
    try {
      const summary = await fetchSummary(g.league.code as LeagueCode, g.espnEventId!);
      const detailsJson = {
        scoreboard: existing?.scoreboard ?? existing ?? null,
        summary,
      };
      await prisma.game.update({ where: { id: g.id }, data: { detailsJson: detailsJson as any } });
      ok++;
      process.stdout.write(".");
      await sleep(120); // be gentle with ESPN
    } catch (err) {
      failed++;
      console.log(`\n  fail id=${g.id} (${g.league.code} ${g.espnEventId}): ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. Updated ${ok}, skipped ${skipped}, failed ${failed}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
