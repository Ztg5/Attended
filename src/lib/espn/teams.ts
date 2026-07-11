/**
 * Team resolver: turns a CSV nickname ("Cavs", "Niners") into an ESPN team,
 * scoped by league so cross-league nickname collisions can't happen.
 *
 * Primary strategy is exact/loose match against ESPN's own team `name`
 * (nickname) and full name; VARIANTS covers the handful ESPN spells differently
 * than everyday usage.
 */
import { EspnTeam, LeagueCode, fetchTeams } from "./client";

// CSV/everyday nickname -> ESPN nickname (t.name), per common usage.
const VARIANTS: Record<string, string> = {
  cavs: "Cavaliers",
  niners: "49ers",
  bucs: "Buccaneers",
  jays: "Blue Jays",
  sox: "Red Sox", // ambiguous on its own; CSV uses full "Red Sox"/"White Sox"
  dbacks: "Diamondbacks",
  "d-backs": "Diamondbacks",
  wsh: "Wizards",
};

const ALL_LEAGUES: LeagueCode[] = ["NFL", "MLB", "NBA", "NHL"];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface TeamResolver {
  teamsByLeague: Map<LeagueCode, EspnTeam[]>;
  /** Resolve a nickname within a league to an ESPN team, or null. */
  resolve(league: LeagueCode, nickname: string): EspnTeam | null;
  /** Look up a team by ESPN id within a league. */
  byEspnId(league: LeagueCode, espnTeamId: string): EspnTeam | null;
}

export async function buildTeamResolver(
  leagues: LeagueCode[] = ALL_LEAGUES
): Promise<TeamResolver> {
  const teamsByLeague = new Map<LeagueCode, EspnTeam[]>();
  for (const league of leagues) {
    teamsByLeague.set(league, await fetchTeams(league));
  }

  function resolve(league: LeagueCode, nickname: string): EspnTeam | null {
    const teams = teamsByLeague.get(league);
    if (!teams) return null;
    const target = norm(VARIANTS[norm(nickname)] ?? nickname);

    // 1) exact nickname (ESPN t.name)
    let hit = teams.find((t) => norm(t.nickname) === target);
    if (hit) return hit;
    // 2) exact full display name ("Buffalo Bills")
    hit = teams.find((t) => norm(t.name) === target);
    if (hit) return hit;
    // 3) abbreviation ("BUF")
    hit = teams.find((t) => norm(t.abbreviation) === target);
    if (hit) return hit;
    // 4) loose: display name ends with the nickname ("... Bills")
    hit = teams.find((t) => norm(t.name).endsWith(" " + target));
    if (hit) return hit;
    return null;
  }

  function byEspnId(league: LeagueCode, espnTeamId: string): EspnTeam | null {
    const teams = teamsByLeague.get(league);
    return teams?.find((t) => t.espnTeamId === String(espnTeamId)) ?? null;
  }

  return { teamsByLeague, resolve, byEspnId };
}
