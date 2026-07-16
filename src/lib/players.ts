/**
 * Player tracking: sync parsed box-score players into the Player/GamePlayer tables,
 * and lean read queries for the UI. List/detail queries NEVER select detailsJson —
 * they read only the new tables (egress rules).
 */
import { prisma } from "./db";
import { parseBoxscorePlayers } from "./summary";

// Stats that must NOT be summed into a career "total": rates/averages and
// longest-play (max) stats like longRushing / longReception.
const RATE_STAT = /pct$|percent|average|avg$|rating|qbr|^era$|whip|ops$|yardsper|pergame|timeonice|^long/i;

/**
 * Parse box-score players from a summary and upsert Player + GamePlayer rows for one
 * game. Idempotent. `playerCache` (espnPlayerId -> playerId) lets the backfill avoid
 * re-upserting the same person across games.
 */
export async function syncGamePlayers(
  gameId: number,
  leagueId: number,
  summary: unknown,
  playerCache?: Map<string, number>
): Promise<{ players: number; withStats: number }> {
  const parsed = parseBoxscorePlayers(summary);
  if (!parsed.length) return { players: 0, withStats: 0 };

  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: { id: true, espnTeamId: true },
  });
  const teamIdByEspn = new Map(teams.map((t) => [t.espnTeamId, t.id]));

  let withStats = 0;
  for (const p of parsed) {
    let playerId = playerCache?.get(p.espnPlayerId);
    if (playerId == null) {
      const player = await prisma.player.upsert({
        where: { espnPlayerId: p.espnPlayerId },
        create: {
          espnPlayerId: p.espnPlayerId,
          name: p.name,
          position: p.position,
          headshotUrl: p.headshotUrl,
        },
        update: { name: p.name, position: p.position, headshotUrl: p.headshotUrl },
        select: { id: true },
      });
      playerId = player.id;
      playerCache?.set(p.espnPlayerId, playerId);
    }

    const teamId = p.teamEspnId ? teamIdByEspn.get(p.teamEspnId) ?? null : null;
    if (Object.keys(p.stats).length) withStats++;

    await prisma.gamePlayer.upsert({
      where: { gameId_playerId: { gameId, playerId } },
      create: { gameId, playerId, teamId, stats: p.stats },
      update: { teamId, stats: p.stats },
    });
  }

  return { players: parsed.length, withStats };
}

// --- read queries -----------------------------------------------------------

export interface PlayerListItem {
  id: number;
  name: string;
  position: string | null;
  headshotUrl: string | null;
  timesSeen: number;
  leagueCode: string | null;
}

const TACKLE_KEYS = new Set(["totalTackles", "soloTackles", "assistTackles"]);

/**
 * True for players whose entire attended-game history is noise: no recorded stats at all
 * (a DNP/roster line) or nothing but a lone tackle (e.g. an offensive lineman credited
 * with a single tackle). Anyone with a non-tackle stat, or 2+ tackles, is kept.
 */
function isNoisePlayer(games: { stats: unknown }[]): boolean {
  let sawStat = false;
  let sawNonTackle = false;
  let maxTackle = 0;
  for (const g of games) {
    const stats = (g.stats ?? {}) as Record<string, number>;
    for (const [k, v] of Object.entries(stats)) {
      if (typeof v !== "number" || v === 0) continue;
      sawStat = true;
      if (TACKLE_KEYS.has(k)) maxTackle = Math.max(maxTackle, Math.abs(v));
      else sawNonTackle = true;
    }
  }
  if (!sawStat) return true; // never recorded anything
  return !sawNonTackle && maxTackle <= 1; // only a single tackle
}

export async function getPlayersList(userId: string): Promise<PlayerListItem[]> {
  // Players seen = players who appeared in a game THIS user attended. Player rows are
  // global, but both the filter and the times-seen count run through the user's games.
  const attendedGame = { game: { attendances: { some: { userId } } } };
  const players = await prisma.player.findMany({
    where: { gamePlayers: { some: attendedGame } },
    select: {
      id: true,
      name: true,
      position: true,
      headshotUrl: true,
      // stats power the noise filter; league (a player is one sport) comes from any game.
      gamePlayers: {
        where: attendedGame,
        select: { stats: true, game: { select: { league: { select: { code: true } } } } },
      },
    },
  });
  return players
    .filter((p) => !isNoisePlayer(p.gamePlayers))
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      headshotUrl: p.headshotUrl,
      timesSeen: p.gamePlayers.length,
      leagueCode: p.gamePlayers[0]?.game.league.code ?? null,
    }))
    .sort((a, b) => b.timesSeen - a.timesSeen || a.name.localeCompare(b.name));
}

export interface PlayerGameLine {
  gameId: number;
  date: string;
  leagueCode: string;
  homeAbbr: string;
  awayAbbr: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  won: boolean | null; // player's team result, null if undecidable
  stats: Record<string, number>;
}

export interface PlayerDetail {
  id: number;
  name: string;
  position: string | null;
  headshotUrl: string | null;
  games: PlayerGameLine[];
  totals: { key: string; total: number }[];
  record: { wins: number; losses: number };
  statsAvailable: number; // games with any stats (X)
  totalGames: number; // games seen (Y)
}

export async function getPlayerDetail(playerId: number, userId: string): Promise<PlayerDetail | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, name: true, position: true, headshotUrl: true },
  });
  if (!player) return null;

  // Only appearances in games this user attended — totals/record/games are all personal.
  const rows = await prisma.gamePlayer.findMany({
    where: { playerId, game: { attendances: { some: { userId } } } },
    select: {
      teamId: true,
      stats: true,
      game: {
        select: {
          id: true,
          date: true,
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          league: { select: { code: true } },
          homeTeam: { select: { abbreviation: true, logoUrl: true } },
          awayTeam: { select: { abbreviation: true, logoUrl: true } },
        },
      },
    },
    orderBy: { game: { date: "desc" } },
  });
  // The user hasn't seen this player in any attended game — treat as not found.
  if (rows.length === 0) return null;

  const totals = new Map<string, number>();
  let wins = 0;
  let losses = 0;
  let statsAvailable = 0;

  const games: PlayerGameLine[] = rows.map((r) => {
    const g = r.game;
    const stats = (r.stats ?? {}) as Record<string, number>;
    if (Object.keys(stats).length) statsAvailable++;

    // Sum counting stats into career totals (skip rate/average stats).
    for (const [k, v] of Object.entries(stats)) {
      if (typeof v === "number" && !RATE_STAT.test(k)) totals.set(k, (totals.get(k) ?? 0) + v);
    }

    // Player's team result in this game.
    let won: boolean | null = null;
    if (g.homeScore != null && g.awayScore != null && r.teamId != null) {
      const isHome = g.homeTeamId === r.teamId;
      const isAway = g.awayTeamId === r.teamId;
      if (isHome || isAway) {
        const us = isHome ? g.homeScore : g.awayScore;
        const them = isHome ? g.awayScore : g.homeScore;
        if (us !== them) {
          won = us > them;
          if (won) wins++;
          else losses++;
        }
      }
    }

    return {
      gameId: g.id,
      date: g.date.toISOString().slice(0, 10),
      leagueCode: g.league.code,
      homeAbbr: g.homeTeam?.abbreviation ?? "—",
      awayAbbr: g.awayTeam?.abbreviation ?? "—",
      homeLogo: g.homeTeam?.logoUrl ?? null,
      awayLogo: g.awayTeam?.logoUrl ?? null,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      won,
      stats,
    };
  });

  return {
    ...player,
    games,
    totals: [...totals.entries()]
      .map(([key, total]) => ({ key, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total),
    record: { wins, losses },
    statsAvailable,
    totalGames: games.length,
  };
}

export interface GamePlayerLine {
  playerId: number;
  name: string;
  position: string | null;
  headshotUrl: string | null;
  teamId: number | null;
  stats: Record<string, number>;
}

/** Players in one game — for the game detail "who you saw" section. */
export async function getGamePlayers(gameId: number): Promise<GamePlayerLine[]> {
  const rows = await prisma.gamePlayer.findMany({
    where: { gameId },
    select: {
      teamId: true,
      stats: true,
      player: { select: { id: true, name: true, position: true, headshotUrl: true } },
    },
  });
  return rows.map((r) => ({
    playerId: r.player.id,
    name: r.player.name,
    position: r.player.position,
    headshotUrl: r.player.headshotUrl,
    teamId: r.teamId,
    stats: (r.stats ?? {}) as Record<string, number>,
  }));
}

// --- display helpers --------------------------------------------------------

const LABELS: Record<string, string> = {
  passingYards: "Pass Yds", passingTouchdowns: "Pass TD", interceptions: "INT",
  rushingYards: "Rush Yds", rushingTouchdowns: "Rush TD", rushingAttempts: "Rush",
  receptions: "Rec", receivingYards: "Rec Yds", receivingTouchdowns: "Rec TD",
  sacks: "Sacks", totalTackles: "Tackles", soloTackles: "Solo", QBRating: "RTG",
  points: "PTS", rebounds: "REB", assists: "AST", steals: "STL", blocks: "BLK",
  turnovers: "TO", minutes: "MIN", offensiveRebounds: "OREB", defensiveRebounds: "DREB",
  fouls: "PF", plusMinus: "+/-",
  atBats: "AB", runs: "R", hits: "H", RBIs: "RBI", homeRuns: "HR", walks: "BB",
  strikeouts: "K", avg: "AVG", onBasePct: "OBP", slugAvg: "SLG", doubles: "2B", triples: "3B",
  stolenBases: "SB", earnedRuns: "ER", inningsPitched: "IP",
  goals: "G", shotsTotal: "SOG", blockedShots: "BS", penaltyMinutes: "PIM",
  takeaways: "TK", giveaways: "GV", shifts: "SHFT", saves: "SV",
};

// The handful of stats worth showing per game, in priority order per league — the
// "fantasy box line" for each sport. Batters/pitchers (MLB) and each football position
// carry disjoint keys, so one ordered list naturally resolves to the right few.
const HEADLINE_KEYS: Record<string, string[]> = {
  NFL: [
    "passingYards", "passingTouchdowns", "interceptions",
    "rushingYards", "rushingTouchdowns",
    "receptions", "receivingYards", "receivingTouchdowns",
    "sacks", "totalTackles",
  ],
  NBA: ["points", "rebounds", "assists", "steals", "blocks"],
  MLB: [
    "hits", "homeRuns", "RBIs", "runs", "stolenBases",
    "inningsPitched", "strikeouts", "earnedRuns", "walks",
  ],
  NHL: ["goals", "assists", "points", "shotsTotal", "saves"],
};
const MAX_HEADLINE = 4;

/**
 * The most relevant stats for one player-game, capped and ordered like a fantasy line.
 * Falls back to whatever stats exist (capped) for leagues without a curated list.
 */
export function headlineStats(
  leagueCode: string,
  stats: Record<string, number>
): [string, number][] {
  const priority = HEADLINE_KEYS[leagueCode];
  const picked: [string, number][] = [];
  if (priority) {
    for (const k of priority) {
      if (k in stats && picked.length < MAX_HEADLINE) picked.push([k, stats[k]]);
    }
  }
  if (picked.length === 0) return Object.entries(stats).slice(0, MAX_HEADLINE);
  return picked;
}

/** Short display label for an ESPN stat key. */
export function statLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  // de-camelCase fallback: "receivingYards" -> "Receiving Yards"
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  return spaced;
}
