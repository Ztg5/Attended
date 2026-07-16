/**
 * Game matching logic — shared by the import script and (later) the log-a-game
 * flow. Pure with respect to the database: it takes a seed row + a team resolver
 * + the ESPN client, and returns a MatchResult describing what ESPN says and how
 * it relates to the CSV. Persistence happens elsewhere.
 */
import {
  EspnEvent,
  LeagueCode,
  fetchScoreboard,
  fetchTeamSchedule,
  wentToOvertime,
  EspnError,
} from "./espn/client";
import { TeamResolver } from "./espn/teams";

export interface SeedRow {
  league: LeagueCode;
  date: string | null; // YYYY-MM-DD or null (dateless row)
  homeTeam: string;
  awayTeam: string | null; // null = match on the home team alone (log-a-game flow)
  venueOverride: string | null;
  claimedResult: string | null;
  notes: string | null;
  needsReview: boolean; // flagged in the CSV
}

export type MatchCategory = "clean" | "corrected" | "needs_review";
export type GameStatus = "final" | "pending" | "needs_review";

export interface ResolvedVenue {
  espnVenueId: string | null;
  name: string | null;
  city: string | null;
  state: string | null;
}

export interface MatchResult {
  row: SeedRow;
  category: MatchCategory;
  status: GameStatus;
  reasons: string[]; // corrections and/or review reasons, human-readable
  matchedDate: string | null; // the date ESPN matched on (may differ from CSV)
  event: EspnEvent | null;

  homeTeamEspnId: string | null; // final orientation (ESPN's home/away on match)
  awayTeamEspnId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  seasonYear: number;
  isPostseason: boolean;
  postseasonRound: string | null;
  wentToOvertime: boolean;
  attendance: number | null;
  venue: ResolvedVenue | null;
}

// --- date helpers (UTC, calendar-only) -------------------------------------

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** NFL Jan/Feb games belong to the prior calendar year's season. */
function fallbackSeasonYear(league: LeagueCode, isoDate: string | null): number {
  if (!isoDate) return new Date().getUTCFullYear();
  const d = new Date(isoDate + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1; // 1-12
  if (league === "NFL" && m <= 2) return y - 1;
  return y;
}

// --- claimed_result cross-check --------------------------------------------

interface ParsedClaim {
  teamNick: string;
  won: boolean;
  winnerScore: number | null;
  loserScore: number | null;
}

/** "Bills W 31-17" / "Steelers W 23-16" / "Bills W" -> structured claim. */
export function parseClaim(claim: string | null): ParsedClaim | null {
  if (!claim || !claim.trim()) return null;
  const m = claim.trim().match(/^(.+?)\s+([WL])(?:\s+(\d+)\s*-\s*(\d+))?$/i);
  if (!m) return null;
  return {
    teamNick: m[1].trim(),
    won: m[2].toUpperCase() === "W",
    winnerScore: m[3] != null ? Number(m[3]) : null,
    loserScore: m[4] != null ? Number(m[4]) : null,
  };
}

/** Returns a mismatch reason string, or null if the claim checks out / can't be checked. */
function crossCheckClaim(
  claim: ParsedClaim,
  event: EspnEvent,
  resolver: TeamResolver,
  league: LeagueCode
): string | null {
  const named = resolver.resolve(league, claim.teamNick);
  if (!named) return null; // can't verify an unresolved claimed team; don't punish
  const me = event.competitors.find((c) => c.espnTeamId === named.espnTeamId);
  const other = event.competitors.find((c) => c.espnTeamId !== named?.espnTeamId);
  if (!me || !other) {
    return `claimed winner "${claim.teamNick}" is not in the matched game`;
  }

  // Determine actual W/L from winner flags, falling back to scores.
  let actualWon: boolean | null =
    typeof me.winner === "boolean" ? me.winner : null;
  if (actualWon === null && me.score != null && other.score != null) {
    actualWon = me.score > other.score;
  }
  if (actualWon !== null && actualWon !== claim.won) {
    return `claimed ${claim.teamNick} ${claim.won ? "W" : "L"} but ESPN says otherwise`;
  }

  if (claim.winnerScore != null && claim.loserScore != null) {
    const myScore = claim.won ? claim.winnerScore : claim.loserScore;
    const oppScore = claim.won ? claim.loserScore : claim.winnerScore;
    if (me.score !== myScore || other.score !== oppScore) {
      return `claimed score ${claim.winnerScore}-${claim.loserScore} != ESPN ${me.score}-${other.score}`;
    }
  }
  return null;
}

// --- date resolution for the dateless row ----------------------------------

/** Resolve a dateless row via the home team's season schedule. */
async function resolveDatelessDate(
  row: SeedRow,
  resolver: TeamResolver
): Promise<{ date: string | null; note: string }> {
  if (!row.awayTeam) return { date: null, note: "dateless row needs an away team" };
  const homeT = resolver.resolve(row.league, row.homeTeam);
  const awayT = resolver.resolve(row.league, row.awayTeam);
  if (!homeT || !awayT) return { date: null, note: "dateless + unresolved teams" };

  // Season hint: first 4-digit year mentioned in the notes, else current year.
  const yearMatch = row.notes?.match(/(19|20)\d{2}/);
  const season = yearMatch ? Number(yearMatch[0]) : new Date().getUTCFullYear();

  try {
    const events = await fetchTeamSchedule(row.league, homeT.espnTeamId, season);
    const hit = events.find((e) => {
      const home = e.competitors.find((c) => c.homeAway === "home");
      const away = e.competitors.find((c) => c.homeAway === "away");
      return (
        home?.espnTeamId === homeT.espnTeamId &&
        away?.espnTeamId === awayT.espnTeamId
      );
    });
    if (hit?.dateIso) {
      return {
        date: hit.dateIso.slice(0, 10),
        note: `date resolved from ${season} ${homeT.abbreviation} schedule`,
      };
    }
    return { date: null, note: `no home ${row.awayTeam} game in ${season} schedule` };
  } catch (err) {
    return { date: null, note: `schedule lookup failed: ${(err as EspnError).message}` };
  }
}

// --- the matcher ------------------------------------------------------------

export async function matchRow(
  row: SeedRow,
  resolver: TeamResolver
): Promise<MatchResult> {
  const reasons: string[] = [];
  const homeT = resolver.resolve(row.league, row.homeTeam);
  const awayT = row.awayTeam ? resolver.resolve(row.league, row.awayTeam) : null;

  const base: MatchResult = {
    row,
    category: "needs_review",
    status: "needs_review",
    reasons,
    matchedDate: null,
    event: null,
    homeTeamEspnId: homeT?.espnTeamId ?? null,
    awayTeamEspnId: awayT?.espnTeamId ?? null,
    homeScore: null,
    awayScore: null,
    seasonYear: fallbackSeasonYear(row.league, row.date),
    isPostseason: false,
    postseasonRound: null,
    wentToOvertime: false,
    attendance: null,
    venue: row.venueOverride
      ? { espnVenueId: null, name: row.venueOverride, city: null, state: null }
      : null,
  };

  if (!homeT || (row.awayTeam && !awayT)) {
    if (!homeT) reasons.push(`unresolved team nickname: "${row.homeTeam}"`);
    if (row.awayTeam && !awayT) reasons.push(`unresolved team nickname: "${row.awayTeam}"`);
    return base;
  }

  // Resolve candidate dates (handles the dateless row).
  let candidateDates: string[];
  if (row.date) {
    candidateDates = [row.date, shiftDate(row.date, -1), shiftDate(row.date, 1)];
  } else if (!row.awayTeam) {
    reasons.push("a date is required when only the home team is given");
    return base;
  } else {
    const resolved = await resolveDatelessDate(row, resolver);
    reasons.push(resolved.note);
    if (!resolved.date) return base;
    candidateDates = [
      resolved.date,
      shiftDate(resolved.date, -1),
      shiftDate(resolved.date, 1),
    ];
  }

  // Find the first date whose scoreboard contains both teams.
  let event: EspnEvent | null = null;
  let matchedDate: string | null = null;
  let anyFetchOk = false;
  for (const date of candidateDates) {
    let events: EspnEvent[];
    try {
      events = await fetchScoreboard(row.league, date);
      anyFetchOk = true;
    } catch {
      continue; // ESPN hiccup on this date — try the next
    }
    // A team plays at most one game per date, so the picked team alone identifies it
    // (on either side); when an away team is also given, require both.
    const hit = events.find((e) => {
      if (!e.competitors.some((c) => c.espnTeamId === homeT.espnTeamId)) return false;
      return awayT ? e.competitors.some((c) => c.espnTeamId === awayT.espnTeamId) : true;
    });
    if (hit) {
      event = hit;
      matchedDate = date;
      break;
    }
  }

  if (!event || !matchedDate) {
    reasons.push(anyFetchOk ? "no ESPN game matched" : "ESPN fetch failed for all dates");
    return base;
  }

  // Take home/away orientation from ESPN.
  const espnHome = event.competitors.find((c) => c.homeAway === "home");
  const espnAway = event.competitors.find((c) => c.homeAway === "away");

  const result: MatchResult = {
    ...base,
    event,
    matchedDate,
    homeTeamEspnId: espnHome?.espnTeamId ?? homeT.espnTeamId,
    awayTeamEspnId: espnAway?.espnTeamId ?? awayT?.espnTeamId ?? null,
    homeScore: espnHome?.score ?? null,
    awayScore: espnAway?.score ?? null,
    seasonYear: event.seasonYear,
    isPostseason: event.isPostseason,
    postseasonRound: event.postseasonRound,
    wentToOvertime: wentToOvertime(row.league, event.period),
    attendance: event.attendance,
    venue: event.venue.espnVenueId || event.venue.name ? event.venue : base.venue,
  };

  // Corrections relative to the CSV.
  if (row.date && matchedDate !== row.date) {
    result.reasons.push(`date corrected ${row.date} -> ${matchedDate}`);
  }
  if (row.awayTeam && espnHome && espnHome.espnTeamId !== homeT.espnTeamId) {
    result.reasons.push(
      `home/away swapped vs CSV (ESPN home = ${
        resolver.byEspnId(row.league, espnHome.espnTeamId)?.nickname ?? espnHome.espnTeamId
      })`
    );
  }

  // Venue override: trust ESPN unless it disagrees with an explicit override.
  if (row.venueOverride) {
    const espnName = (event.venue.name ?? "").toLowerCase();
    if (!espnName.includes(row.venueOverride.toLowerCase())) {
      result.venue = {
        espnVenueId: event.venue.espnVenueId,
        name: row.venueOverride,
        city: event.venue.city,
        state: event.venue.state,
      };
      result.reasons.push(
        `venue override applied ("${row.venueOverride}"; ESPN said "${event.venue.name}")`
      );
    } else {
      result.reasons.push(`venue confirmed by ESPN ("${event.venue.name}")`);
    }
  }

  // Cross-check the claimed result.
  const claim = parseClaim(row.claimedResult);
  let resultMismatch: string | null = null;
  if (claim) {
    resultMismatch = crossCheckClaim(claim, event, resolver, row.league);
    if (resultMismatch) result.reasons.push(`RESULT MISMATCH: ${resultMismatch}`);
  }

  // Final category / status.
  const espnStatus: GameStatus = event.isFinal ? "final" : "pending";
  if (row.needsReview) {
    result.category = "needs_review";
    result.status = "needs_review";
    result.reasons.push("flagged needs_review in CSV (kept for manual review)");
  } else if (resultMismatch) {
    result.category = "needs_review";
    result.status = "needs_review";
  } else if (result.reasons.some((r) => r.startsWith("date corrected") || r.startsWith("home/away swapped") || r.startsWith("venue override applied"))) {
    result.category = "corrected";
    result.status = espnStatus;
  } else {
    result.category = "clean";
    result.status = espnStatus;
  }

  return result;
}
