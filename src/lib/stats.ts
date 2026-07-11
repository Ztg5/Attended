/**
 * Derived dashboard data — computed from the games table on every read, never stored.
 *
 * "Followed team" nuance: the plan says a followed team is one seen 3+ times (Bills,
 * Guardians, Cavs). Taken literally, "3+ appearances" also catches frequent *opponents*
 * (the Patriots show up 6 times, but only ever against the Bills). So we refine it to
 * **3+ games against 3+ distinct opponents** — you keep coming back to see *them*. That
 * yields exactly {Bills, Guardians, Cavs} and excludes rivals you only saw as the away
 * team. Each attended game has at most one followed team (they never play each other),
 * so "my result" is unambiguous.
 */
import { prisma } from "./db";

export interface TeamLite {
  id: number;
  nickname: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface GameLite {
  id: number;
  date: string; // YYYY-MM-DD
  leagueCode: string;
  seasonYear: number;
  home: TeamLite | null;
  away: TeamLite | null;
  homeScore: number | null;
  awayScore: number | null;
  venueName: string | null;
  venueCity: string | null;
  venueState: string | null;
  isPostseason: boolean;
  postseasonRound: string | null;
  wentToOvertime: boolean;
  attendance: number | null;
  status: string;
  notes: string | null;
}

export interface Record2 {
  wins: number;
  losses: number;
  ties: number;
}

export interface FollowedRecord extends Record2 {
  team: TeamLite;
  games: number;
}

export interface DashboardData {
  totalGames: number;
  perLeague: { code: string; count: number }[];
  venuesVisited: number;
  overall: Record2;
  followed: FollowedRecord[];
  currentWinStreak: number;
  longestWinStreak: number;
  records: {
    biggestBlowout: GameLite | null;
    highestScoring: GameLite | null;
    closest: GameLite | null;
    playoffCount: number;
    firstByLeague: { code: string; game: GameLite }[];
    firstRoad: GameLite | null;
  };
  recentGames: GameLite[];
}

function toLite(g: any): GameLite {
  const t = (tm: any): TeamLite | null =>
    tm
      ? {
          id: tm.id,
          nickname: tm.nickname,
          name: tm.name,
          abbreviation: tm.abbreviation,
          logoUrl: tm.logoUrl,
          primaryColor: tm.primaryColor,
        }
      : null;
  return {
    id: g.id,
    date: g.date.toISOString().slice(0, 10),
    leagueCode: g.league.code,
    seasonYear: g.seasonYear,
    home: t(g.homeTeam),
    away: t(g.awayTeam),
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    venueName: g.venue?.name ?? null,
    venueCity: g.venue?.city ?? null,
    venueState: g.venue?.state ?? null,
    isPostseason: g.isPostseason,
    postseasonRound: g.postseasonRound,
    wentToOvertime: g.wentToOvertime,
    attendance: g.attendance,
    status: g.status,
    notes: g.notes ?? null,
  };
}

const INCLUDE = { league: true, homeTeam: true, awayTeam: true, venue: true } as const;

export async function getAllGames(): Promise<GameLite[]> {
  const games = await prisma.game.findMany({ include: INCLUDE, orderBy: { date: "desc" } });
  return games.map(toLite);
}

/** My result in a game, from the followed team's perspective. Null if no single followed team. */
function personalResult(g: GameLite, followed: Set<number>) {
  const homeF = g.home && followed.has(g.home.id);
  const awayF = g.away && followed.has(g.away.id);
  let team: TeamLite | null = null;
  let us: number | null = null;
  let them: number | null = null;
  let home = false;
  if (homeF && !awayF) {
    team = g.home;
    us = g.homeScore;
    them = g.awayScore;
    home = true;
  } else if (awayF && !homeF) {
    team = g.away;
    us = g.awayScore;
    them = g.homeScore;
    home = false;
  } else return null;
  if (team == null || us == null || them == null) return null;
  return { team, won: us > them, tie: us === them, home };
}

export async function getDashboard(): Promise<DashboardData> {
  const games = (await prisma.game.findMany({ include: INCLUDE })).map(toLite);
  const asc = [...games].sort((a, b) => a.date.localeCompare(b.date));

  // Appearances + distinct opponents per team -> followed set.
  const appear = new Map<number, { team: TeamLite; opps: Set<number> }>();
  const bump = (t: TeamLite | null, opp: TeamLite | null) => {
    if (!t) return;
    const e = appear.get(t.id) ?? { team: t, opps: new Set<number>() };
    if (opp) e.opps.add(opp.id);
    appear.set(t.id, e);
  };
  for (const g of games) {
    bump(g.home, g.away);
    bump(g.away, g.home);
  }
  const followedIds = new Set<number>();
  const followedTeams: TeamLite[] = [];
  for (const [id, e] of appear) {
    const count = games.filter((g) => g.home?.id === id || g.away?.id === id).length;
    if (count >= 3 && e.opps.size >= 3) {
      followedIds.add(id);
      followedTeams.push(e.team);
    }
  }

  // Records (overall + per followed team).
  const overall: Record2 = { wins: 0, losses: 0, ties: 0 };
  const perTeam = new Map<number, FollowedRecord>();
  for (const t of followedTeams)
    perTeam.set(t.id, { team: t, wins: 0, losses: 0, ties: 0, games: 0 });
  for (const g of games) {
    const r = personalResult(g, followedIds);
    if (!r) continue;
    const rec = perTeam.get(r.team.id)!;
    rec.games++;
    if (r.tie) {
      overall.ties++;
      rec.ties++;
    } else if (r.won) {
      overall.wins++;
      rec.wins++;
    } else {
      overall.losses++;
      rec.losses++;
    }
  }

  // Streaks over personal-result games in date order.
  let longestWinStreak = 0;
  let run = 0;
  let currentWinStreak = 0;
  for (const g of asc) {
    const r = personalResult(g, followedIds);
    if (!r || r.tie) continue;
    if (r.won) {
      run++;
      longestWinStreak = Math.max(longestWinStreak, run);
      currentWinStreak = run;
    } else {
      run = 0;
      currentWinStreak = 0;
    }
  }

  // Personal records.
  const scored = games.filter((g) => g.homeScore != null && g.awayScore != null);
  const margin = (g: GameLite) => Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0));
  const total = (g: GameLite) => (g.homeScore ?? 0) + (g.awayScore ?? 0);
  const maxBy = (arr: GameLite[], f: (g: GameLite) => number) =>
    arr.length ? arr.reduce((best, g) => (f(g) > f(best) ? g : best)) : null;
  const minBy = (arr: GameLite[], f: (g: GameLite) => number) =>
    arr.length ? arr.reduce((best, g) => (f(g) < f(best) ? g : best)) : null;

  const perLeagueCounts = new Map<string, number>();
  for (const g of games) perLeagueCounts.set(g.leagueCode, (perLeagueCounts.get(g.leagueCode) ?? 0) + 1);

  const firstByLeague: { code: string; game: GameLite }[] = [];
  for (const code of perLeagueCounts.keys()) {
    const first = asc.find((g) => g.leagueCode === code);
    if (first) firstByLeague.push({ code, game: first });
  }
  firstByLeague.sort((a, b) => a.game.date.localeCompare(b.game.date));

  const firstRoad =
    asc.find((g) => {
      const r = personalResult(g, followedIds);
      return r && !r.home;
    }) ?? null;

  const venuesVisited = new Set(games.map((g) => g.venueName).filter(Boolean)).size;

  return {
    totalGames: games.length,
    perLeague: [...perLeagueCounts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    venuesVisited,
    overall,
    followed: [...perTeam.values()].sort((a, b) => b.games - a.games),
    currentWinStreak,
    longestWinStreak,
    records: {
      biggestBlowout: maxBy(scored, margin),
      highestScoring: maxBy(scored, total),
      closest: minBy(scored, margin),
      playoffCount: games.filter((g) => g.isPostseason).length,
      firstByLeague,
      firstRoad,
    },
    recentGames: [...games].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
  };
}
