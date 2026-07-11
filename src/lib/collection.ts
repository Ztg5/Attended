/** Collection data — team checklists and stadiums visited. Computed from games. */
import { prisma } from "./db";

export interface ChecklistTeam {
  id: number;
  name: string;
  nickname: string;
  abbreviation: string;
  logoUrl: string | null;
  seen: boolean;
}

export interface LeagueChecklist {
  code: string;
  name: string;
  seen: number;
  total: number;
  teams: ChecklistTeam[];
}

export async function getChecklist(): Promise<LeagueChecklist[]> {
  const [leagues, games] = await Promise.all([
    prisma.league.findMany({ include: { teams: { orderBy: { name: "asc" } } } }),
    prisma.game.findMany({ select: { homeTeamId: true, awayTeamId: true } }),
  ]);

  const seen = new Set<number>();
  for (const g of games) {
    if (g.homeTeamId) seen.add(g.homeTeamId);
    if (g.awayTeamId) seen.add(g.awayTeamId);
  }

  return leagues
    .map((l): LeagueChecklist => {
      const teams = l.teams.map((t) => ({
        id: t.id,
        name: t.name,
        nickname: t.nickname,
        abbreviation: t.abbreviation,
        logoUrl: t.logoUrl,
        seen: seen.has(t.id),
      }));
      return {
        code: l.code,
        name: l.name,
        seen: teams.filter((t) => t.seen).length,
        total: teams.length,
        teams,
      };
    })
    .sort((a, b) => b.seen - a.seen || b.total - a.total);
}

export interface VenueVisit {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  games: number;
  firstVisit: string;
  lastVisit: string;
  teamColor: string | null;
  teamLogo: string | null;
  teamName: string | null;
  leagueCode: string;
}

export async function getVenues(): Promise<VenueVisit[]> {
  const venues = await prisma.venue.findMany({
    include: {
      games: { include: { homeTeam: true, league: true }, orderBy: { date: "asc" } },
    },
  });

  return venues
    .filter((v) => v.games.length > 0)
    .map((v): VenueVisit => {
      const games = v.games;
      // Most frequent home team → pin color / logo.
      const counts = new Map<number, { team: (typeof games)[0]["homeTeam"]; n: number }>();
      for (const g of games) {
        if (!g.homeTeam) continue;
        const e = counts.get(g.homeTeam.id) ?? { team: g.homeTeam, n: 0 };
        e.n++;
        counts.set(g.homeTeam.id, e);
      }
      const top = [...counts.values()].sort((a, b) => b.n - a.n)[0]?.team ?? null;

      return {
        id: v.id,
        name: v.name,
        city: v.city,
        state: v.state,
        lat: v.latitude,
        lng: v.longitude,
        games: games.length,
        firstVisit: games[0].date.toISOString().slice(0, 10),
        lastVisit: games[games.length - 1].date.toISOString().slice(0, 10),
        teamColor: top?.primaryColor ?? null,
        teamLogo: top?.logoUrl ?? null,
        teamName: top?.name ?? null,
        leagueCode: games[0].league.code,
      };
    })
    .sort((a, b) => b.games - a.games);
}
