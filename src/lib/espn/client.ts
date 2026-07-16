/**
 * ESPN API client — the single chokepoint for ESPN's undocumented public API.
 *
 * If ESPN changes an endpoint or shape, this file is the only place to fix.
 * Every call is best-effort: network/parse failures throw EspnError, and callers
 * (matching / import) are expected to degrade to needs_review rather than crash.
 */

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports";

export type LeagueCode = "NFL" | "MLB" | "NBA" | "NHL";

// League code -> ESPN {sport}/{league} path segment.
const LEAGUE_PATH: Record<LeagueCode, string> = {
  NFL: "football/nfl",
  MLB: "baseball/mlb",
  NBA: "basketball/nba",
  NHL: "hockey/nhl",
};

// Regulation period count per league — used to detect OT / extra innings.
export const REGULATION_PERIODS: Record<LeagueCode, number> = {
  NFL: 4,
  NBA: 4,
  MLB: 9,
  NHL: 3,
};

export class EspnError extends Error {
  constructor(message: string, readonly url: string) {
    super(message);
    this.name = "EspnError";
  }
}

async function getJson(url: string, init?: { next?: { revalidate?: number } }): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": "attended/0.1 (personal project)" },
      ...init,
    });
  } catch (err) {
    throw new EspnError(`network error: ${(err as Error).message}`, url);
  }
  if (!res.ok) {
    throw new EspnError(`HTTP ${res.status}`, url);
  }
  try {
    return await res.json();
  } catch (err) {
    throw new EspnError(`bad JSON: ${(err as Error).message}`, url);
  }
}

/** YYYY-MM-DD (or Date) -> YYYYMMDD as ESPN expects. */
export function toEspnDate(date: string | Date): string {
  const d = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  return d.replace(/-/g, "");
}

// ---- Normalized shapes the rest of the app consumes ------------------------

export interface EspnTeam {
  espnTeamId: string;
  name: string; // displayName, e.g. "Buffalo Bills"
  nickname: string; // "Bills"
  location: string | null; // "Buffalo"
  abbreviation: string;
  logoUrl: string | null;
  primaryColor: string | null;
  active: boolean;
}

export interface EspnCompetitor {
  espnTeamId: string;
  homeAway: "home" | "away";
  score: number | null;
  winner: boolean | null;
}

export interface EspnEvent {
  espnEventId: string;
  dateIso: string; // full ISO datetime from ESPN
  seasonYear: number;
  seasonType: number; // 1 pre, 2 regular, 3 post
  isPostseason: boolean;
  postseasonRound: string | null;
  statusName: string; // e.g. STATUS_FINAL
  isFinal: boolean;
  period: number;
  competitors: EspnCompetitor[];
  venue: {
    espnVenueId: string | null;
    name: string | null;
    city: string | null;
    state: string | null;
  };
  attendance: number | null;
  details: unknown; // raw-ish blob for details_json
}

// ---- Endpoints -------------------------------------------------------------

/** Teams list for a league (for seeding the Team table). */
export async function fetchTeams(league: LeagueCode): Promise<EspnTeam[]> {
  const url = `${SITE_BASE}/${LEAGUE_PATH[league]}/teams`;
  const json = await getJson(url);
  const raw = json?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return raw.map((entry: any): EspnTeam => {
    const t = entry.team;
    const logo =
      t.logos?.find((l: any) => (l.rel ?? []).includes("default"))?.href ??
      t.logos?.[0]?.href ??
      null;
    return {
      espnTeamId: String(t.id),
      name: t.displayName,
      nickname: t.name,
      location: t.location ?? null,
      abbreviation: t.abbreviation,
      logoUrl: logo,
      primaryColor: t.color ?? null,
      active: t.isActive !== false,
    };
  });
}

/** Scoreboard for a league on a single date. Returns normalized events. */
export async function fetchScoreboard(
  league: LeagueCode,
  date: string | Date
): Promise<EspnEvent[]> {
  const url = `${SITE_BASE}/${LEAGUE_PATH[league]}/scoreboard?dates=${toEspnDate(date)}`;
  const json = await getJson(url);
  const events = json?.events ?? [];
  return events.map((e: any) => normalizeEvent(league, e));
}

/** A team's schedule for a season — used to resolve the dateless seed row. */
export async function fetchTeamSchedule(
  league: LeagueCode,
  espnTeamId: string,
  season: number
): Promise<EspnEvent[]> {
  const url = `${SITE_BASE}/${LEAGUE_PATH[league]}/teams/${espnTeamId}/schedule?season=${season}`;
  const json = await getJson(url);
  const events = json?.events ?? [];
  return events.map((e: any) => normalizeEvent(league, e));
}

/**
 * A team's full season for the /schedule batch-add page (cached 24h): regular season
 * (seasontype=2) AND postseason (seasontype=3), since ESPN returns only the regular
 * season by default. Merged, deduped by event id, sorted by date.
 */
export async function fetchTeamScheduleCached(
  league: LeagueCode,
  espnTeamId: string,
  season: number
): Promise<EspnEvent[]> {
  const fetchType = async (seasontype: 2 | 3): Promise<EspnEvent[]> => {
    const url = `${SITE_BASE}/${LEAGUE_PATH[league]}/teams/${espnTeamId}/schedule?season=${season}&seasontype=${seasontype}`;
    try {
      const json = await getJson(url, { next: { revalidate: 86400 } });
      return (json?.events ?? []).map((e: any) => normalizeEvent(league, e));
    } catch {
      return []; // a missing postseason (team didn't make it) is expected
    }
  };

  const [regular, postseason] = await Promise.all([fetchType(2), fetchType(3)]);
  const byId = new Map<string, EspnEvent>();
  for (const e of [...regular, ...postseason]) byId.set(e.espnEventId, e);
  return [...byId.values()].sort((a, b) => (a.dateIso ?? "").localeCompare(b.dateIso ?? ""));
}

/** Event summary — richer per-game detail (line scores, weather, broadcast). */
export async function fetchSummary(
  league: LeagueCode,
  espnEventId: string
): Promise<unknown> {
  const url = `${SITE_BASE}/${LEAGUE_PATH[league]}/summary?event=${espnEventId}`;
  return getJson(url);
}

// ---- Normalization ---------------------------------------------------------

/**
 * Parse a competitor score to a finite number or null. The scoreboard endpoint returns
 * a string ("24"); the team-schedule endpoint returns an object ({ value, displayValue }).
 * Anything else (unplayed games, malformed) becomes null — never NaN.
 */
function parseScore(raw: any): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "object" ? Number(raw.value ?? raw.displayValue) : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeEvent(league: LeagueCode, e: any): EspnEvent {
  const comp = e.competitions?.[0] ?? {};
  // The scoreboard endpoint marks the season type on e.season.type (a number); the
  // team-schedule endpoint marks it on e.seasonType ({ type: 3, name: "Postseason" }).
  // comp.type is the GAME format ("Standard"), not the season type — don't use it here.
  const seasonType = e.season?.type ?? e.seasonType?.type ?? e.seasonType?.id ?? 2;
  const statusType = comp.status?.type ?? e.status?.type ?? {};
  const period = comp.status?.period ?? e.status?.period ?? 0;

  const competitors: EspnCompetitor[] = (comp.competitors ?? []).map(
    (c: any): EspnCompetitor => ({
      espnTeamId: String(c.team?.id ?? c.id),
      homeAway: c.homeAway,
      score: parseScore(c.score),
      winner: typeof c.winner === "boolean" ? c.winner : null,
    })
  );

  const venue = comp.venue ?? {};
  const postseasonRound: string | null =
    comp.notes?.[0]?.headline ?? e.notes?.[0]?.headline ?? null;

  return {
    espnEventId: String(e.id),
    dateIso: e.date ?? comp.date,
    seasonYear: e.season?.year ?? new Date(e.date).getFullYear(),
    seasonType: Number(seasonType),
    isPostseason: Number(seasonType) === 3,
    postseasonRound: Number(seasonType) === 3 ? postseasonRound : null,
    statusName: statusType.name ?? "STATUS_UNKNOWN",
    isFinal: statusType.completed === true || statusType.name === "STATUS_FINAL",
    period: Number(period) || 0,
    competitors,
    venue: {
      espnVenueId: venue.id != null ? String(venue.id) : null,
      name: venue.fullName ?? null,
      city: venue.address?.city ?? null,
      state: venue.address?.state ?? null,
    },
    attendance:
      comp.attendance != null && comp.attendance > 0 ? Number(comp.attendance) : null,
    // Curated blob — keeps the useful bits without dragging the whole payload.
    details: {
      shortName: e.shortName,
      season: e.season,
      week: e.week,
      status: comp.status,
      broadcasts: comp.broadcasts,
      notes: comp.notes,
      weather: e.weather ?? comp.weather,
      linescores: (comp.competitors ?? []).map((c: any) => ({
        team: c.team?.abbreviation,
        homeAway: c.homeAway,
        linescores: c.linescores,
      })),
    },
  };
}

export function wentToOvertime(league: LeagueCode, period: number): boolean {
  return period > REGULATION_PERIODS[league];
}
