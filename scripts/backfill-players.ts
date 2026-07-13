/**
 * One-time backfill: parse box-score players from each game's already-stored
 * details_json and create Player + GamePlayer rows. Makes ZERO new ESPN calls.
 * Thin/old games (2010-2013) often have no box score — those are skipped and
 * reported. Idempotent (re-runnable).
 *
 *   npx tsx --env-file=.env scripts/backfill-players.ts
 */
import { prisma } from "../src/lib/db";
import { extractSummary } from "../src/lib/summary";
import { syncGamePlayers } from "../src/lib/players";

async function main() {
  // Fetch the game list WITHOUT detailsJson, then stream each blob one at a time
  // so we never pull all summaries into one giant response.
  const games = await prisma.game.findMany({
    select: { id: true, leagueId: true, date: true, league: { select: { code: true } } },
    orderBy: { date: "asc" },
  });
  console.log(`${games.length} games. Parsing players from stored details_json (no ESPN calls)...`);

  const playerCache = new Map<string, number>();
  let withData = 0;
  let totalAppearances = 0;
  const withoutData: string[] = [];

  for (const g of games) {
    const row = await prisma.game.findUnique({ where: { id: g.id }, select: { detailsJson: true } });
    const summary = extractSummary(row?.detailsJson);
    const res = summary ? await syncGamePlayers(g.id, g.leagueId, summary, playerCache) : { players: 0, withStats: 0 };
    if (res.players > 0) {
      withData++;
      totalAppearances += res.players;
      process.stdout.write(".");
    } else {
      withoutData.push(`${g.league.code} ${g.date.toISOString().slice(0, 10)} (id ${g.id})`);
    }
  }

  console.log(
    `\n\nDone. ${withData}/${games.length} games with player data — ${totalAppearances} appearances, ${playerCache.size} distinct players.`
  );
  console.log(`${withoutData.length} games without box-score players:`);
  withoutData.forEach((m) => console.log(`  - ${m}`));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
