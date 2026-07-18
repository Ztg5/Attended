/**
 * Backfill Team.primaryColor + Team.secondaryColor from ESPN.
 *
 * Colors are the only thing touched — teams are matched on (leagueId, espnTeamId)
 * and nothing else is written, so this is safe to re-run and never disturbs games
 * or attendance. Needed because the Zubaz profile banner uses the COLOR PAIR:
 * primaries alone cluster in navy/black and can't tell teams apart.
 *
 *   npx tsx --env-file=.env scripts/backfill-team-colors.ts
 */
import { prisma } from "../src/lib/db";
import { fetchTeams } from "../src/lib/espn/client";
import type { LeagueCode } from "../src/lib/espn/client";

const LEAGUES: LeagueCode[] = ["NFL", "MLB", "NBA", "NHL"];

async function main() {
  let updated = 0;
  let missingAlt = 0;

  for (const code of LEAGUES) {
    const league = await prisma.league.findUnique({ where: { code } });
    if (!league) {
      console.log(`${code}: not in DB, skipping`);
      continue;
    }

    let teams;
    try {
      teams = await fetchTeams(code);
    } catch (err) {
      console.log(`${code}: ESPN fetch failed (${(err as Error).message}) — skipping`);
      continue;
    }

    let n = 0;
    for (const t of teams) {
      if (!t.primaryColor && !t.secondaryColor) continue;
      if (!t.secondaryColor) missingAlt++;
      const res = await prisma.team.updateMany({
        where: { leagueId: league.id, espnTeamId: t.espnTeamId },
        data: { primaryColor: t.primaryColor, secondaryColor: t.secondaryColor },
      });
      n += res.count;
    }
    updated += n;
    console.log(`${code}: updated ${n} of ${teams.length} teams`);
  }

  const withPair = await prisma.team.count({
    where: { primaryColor: { not: null }, secondaryColor: { not: null } },
  });
  const total = await prisma.team.count();
  console.log(`\nDone. ${updated} rows written. ${withPair}/${total} teams now have a color pair.`);
  if (missingAlt) console.log(`${missingAlt} ESPN teams had no alternateColor.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
