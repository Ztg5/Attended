/**
 * Seed the League and Team tables from ESPN. Venues are created lazily during
 * game import (keyed by ESPN venue id), so they aren't seeded here.
 *
 * Run standalone:  npm run seed:espn
 * Or call seedLeaguesAndTeams() from the import script.
 */
import { prisma } from "../src/lib/db";
import { LeagueCode } from "../src/lib/espn/client";
import { buildTeamResolver, TeamResolver } from "../src/lib/espn/teams";

const LEAGUES: { code: LeagueCode; name: string }[] = [
  { code: "NFL", name: "National Football League" },
  { code: "MLB", name: "Major League Baseball" },
  { code: "NBA", name: "National Basketball Association" },
  { code: "NHL", name: "National Hockey League" },
];

export async function seedLeaguesAndTeams(
  resolver?: TeamResolver
): Promise<{ leagues: number; teams: number }> {
  const r = resolver ?? (await buildTeamResolver());

  // Leagues (all four, even NHL which has no games yet).
  const leagueIdByCode = new Map<LeagueCode, number>();
  for (const l of LEAGUES) {
    const row = await prisma.league.upsert({
      where: { code: l.code },
      create: { code: l.code, name: l.name },
      update: { name: l.name },
    });
    leagueIdByCode.set(l.code, row.id);
  }

  // Teams per league.
  let teamCount = 0;
  for (const l of LEAGUES) {
    const leagueId = leagueIdByCode.get(l.code)!;
    const teams = r.teamsByLeague.get(l.code) ?? [];
    for (const t of teams) {
      await prisma.team.upsert({
        where: { leagueId_espnTeamId: { leagueId, espnTeamId: t.espnTeamId } },
        create: {
          leagueId,
          espnTeamId: t.espnTeamId,
          name: t.name,
          nickname: t.nickname,
          location: t.location,
          abbreviation: t.abbreviation,
          logoUrl: t.logoUrl,
          primaryColor: t.primaryColor,
          active: t.active,
        },
        update: {
          name: t.name,
          nickname: t.nickname,
          location: t.location,
          abbreviation: t.abbreviation,
          logoUrl: t.logoUrl,
          primaryColor: t.primaryColor,
          active: t.active,
        },
      });
      teamCount++;
    }
  }

  return { leagues: LEAGUES.length, teams: teamCount };
}

// Run directly.
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("seed-espn.ts")) {
  seedLeaguesAndTeams()
    .then((res) => {
      console.log(`Seeded ${res.leagues} leagues and ${res.teams} teams from ESPN.`);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
