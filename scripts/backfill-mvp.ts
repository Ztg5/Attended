/**
 * Backfill Player.isMvp from ESPN's awards data. Idempotent + re-runnable: for each
 * player it resolves their ESPN awards and flags a league MVP (NBA/MLB "MVP",
 * "NFL MVP", NHL "Hart Memorial Trophy"). Run after importing/adding new players.
 *
 *   npm run backfill:mvp
 */
import { prisma } from "../src/lib/db";
import { fetchAthleteIsMvp, type LeagueCode } from "../src/lib/espn/client";

const CONCURRENCY = 6;

async function main() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      espnPlayerId: true,
      name: true,
      isMvp: true,
      // one game is enough to know the player's league (a player is one sport)
      gamePlayers: { take: 1, select: { game: { select: { league: { select: { code: true } } } } } },
    },
  });
  console.log(`Checking ${players.length} players for a league MVP award...`);

  let mvp = 0;
  let changed = 0;
  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < players.length) {
      const p = players[idx++];
      done++;
      const league = p.gamePlayers[0]?.game.league.code as LeagueCode | undefined;
      if (league) {
        const is = await fetchAthleteIsMvp(league, p.espnPlayerId);
        if (is) mvp++;
        if (is !== p.isMvp) {
          await prisma.player.update({ where: { id: p.id }, data: { isMvp: is } });
          changed++;
          if (is) console.log(`  ✔ MVP: ${p.name} (${league})`);
        }
      }
      if (done % 100 === 0) console.log(`  ...${done}/${players.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone. ${mvp} MVPs found, ${changed} player(s) updated.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nBackfill failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
