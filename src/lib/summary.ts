/**
 * Parse a stored ESPN summary blob (detailsJson.summary) into a uniform, render-ready
 * shape. Every section is best-effort and returns null/empty when the data isn't there,
 * so the detail view renders only what exists. Handles the three sports' differing
 * shapes: NFL/NBA flat team stats + leaders + quarter linescores; MLB grouped
 * (batting/pitching) stats, no leaders, and inning linescores with hits/errors.
 */

export interface LineScoreRow {
  abbr: string;
  homeAway: "home" | "away";
  periods: string[];
  total: string;
  hits?: string;
  errors?: string;
}
export interface LineScore {
  periodLabels: string[];
  showHitsErrors: boolean;
  rows: LineScoreRow[]; // away first, then home
}

export interface StatRow {
  label: string;
  away: string;
  home: string;
}
export interface StatGroup {
  title: string | null;
  rows: StatRow[];
}
export interface TeamStats {
  awayAbbr: string;
  homeAbbr: string;
  groups: StatGroup[];
}

export interface LeaderItem {
  category: string;
  name: string;
  value: string;
}
export interface TeamLeaders {
  abbr: string;
  items: LeaderItem[];
}

export interface ParsedSummary {
  lineScore: LineScore | null;
  teamStats: TeamStats | null;
  leaders: TeamLeaders[] | null;
}

// Curated team-level stats for MLB's verbose grouped shape (ESPN dumps 60+ per group).
const MLB_WHITELIST: Record<string, string[]> = {
  batting: ["runs", "hits", "homeRuns", "RBIs", "doubles", "triples", "stolenBases", "walks", "strikeouts", "avg", "OPS"],
  pitching: ["strikeouts", "earnedRuns", "ERA", "walks", "hits", "saves"],
};

function periodLabels(count: number, regulation: number, isBaseball: boolean): string[] {
  return Array.from({ length: count }, (_, i) => {
    if (i < regulation || isBaseball) return String(i + 1); // extra innings keep counting
    return i === regulation ? "OT" : `${i - regulation + 1}OT`;
  });
}

function parseLineScore(raw: any, leagueCode: string): LineScore | null {
  const competitors = raw?.header?.competitions?.[0]?.competitors;
  if (!Array.isArray(competitors) || competitors.length < 2) return null;

  const regulation = Number(raw?.format?.regulation?.periods) || (leagueCode === "MLB" ? 9 : 4);
  const isBaseball = leagueCode === "MLB";

  const rows: LineScoreRow[] = competitors
    .map((c: any): LineScoreRow => {
      const ls = Array.isArray(c.linescores) ? c.linescores : [];
      const sum = (k: string) => ls.reduce((n: number, l: any) => n + (Number(l?.[k]) || 0), 0);
      return {
        abbr: c.team?.abbreviation ?? "—",
        homeAway: c.homeAway === "home" ? "home" : "away",
        periods: ls.map((l: any) => String(l?.displayValue ?? l?.value ?? "")),
        total: String(c.score ?? ""),
        hits: isBaseball ? String(sum("hits")) : undefined,
        errors: isBaseball ? String(sum("errors")) : undefined,
      };
    })
    .sort((a, b) => (a.homeAway === "away" ? -1 : 1));

  const maxPeriods = Math.max(0, ...rows.map((r) => r.periods.length));
  if (maxPeriods === 0) return null;

  return { periodLabels: periodLabels(maxPeriods, regulation, isBaseball), showHitsErrors: isBaseball, rows };
}

function statMap(team: any): { grouped: boolean; team: any } {
  const grouped = Array.isArray(team?.statistics?.[0]?.stats);
  return { grouped, team };
}

function parseTeamStats(raw: any): TeamStats | null {
  const teams = raw?.boxscore?.teams;
  if (!Array.isArray(teams) || teams.length < 2) return null;
  const away = teams.find((t: any) => t.homeAway === "away") ?? teams[0];
  const home = teams.find((t: any) => t.homeAway === "home") ?? teams[1];
  if (!away?.statistics || !home?.statistics) return null;

  const awayAbbr = away.team?.abbreviation ?? "AWAY";
  const homeAbbr = home.team?.abbreviation ?? "HOME";
  const grouped = Array.isArray(away.statistics?.[0]?.stats);

  const groups: StatGroup[] = [];

  if (!grouped) {
    // Flat (NFL/NBA): ESPN's own curated team-stat list. Keep order, show all.
    const hm = new Map<string, string>(home.statistics.map((s: any) => [s.name, s.displayValue]));
    const rows: StatRow[] = away.statistics.map((s: any) => ({
      label: s.label ?? s.displayName ?? s.name,
      away: String(s.displayValue ?? ""),
      home: String(hm.get(s.name) ?? "—"),
    }));
    groups.push({ title: null, rows });
  } else {
    // Grouped (MLB): whitelist a compact team set per group.
    for (const groupName of Object.keys(MLB_WHITELIST)) {
      const ag = away.statistics.find((g: any) => g.name === groupName);
      const hg = home.statistics.find((g: any) => g.name === groupName);
      if (!ag?.stats) continue;
      const am = new Map<string, any>(ag.stats.map((s: any) => [s.name, s]));
      const hm = new Map<string, any>((hg?.stats ?? []).map((s: any) => [s.name, s]));
      const rows: StatRow[] = MLB_WHITELIST[groupName]
        .filter((k) => am.has(k))
        .map((k) => ({
          label: am.get(k).shortDisplayName ?? am.get(k).abbreviation ?? k,
          away: String(am.get(k).displayValue ?? ""),
          home: String(hm.get(k)?.displayValue ?? "—"),
        }));
      if (rows.length) groups.push({ title: ag.displayName ?? groupName, rows });
    }
  }

  return groups.length ? { awayAbbr, homeAbbr, groups } : null;
}

function parseLeaders(raw: any): TeamLeaders[] | null {
  const rawLeaders = raw?.leaders;
  if (!Array.isArray(rawLeaders) || !rawLeaders.length) return null;

  const teams = rawLeaders
    .map((tl: any): TeamLeaders => {
      const cats: any[] = Array.isArray(tl.leaders) ? tl.leaders : [];
      const items: LeaderItem[] = cats
        .map((cat: any): LeaderItem | null => {
          const top = cat?.leaders?.[0];
          if (!top) return null;
          const name = top.athlete?.displayName ?? top.athlete?.shortName ?? "";
          if (!name) return null;
          return { category: cat.displayName ?? cat.name ?? "", name, value: String(top.displayValue ?? "") };
        })
        .filter((x): x is LeaderItem => x !== null);
      return { abbr: tl.team?.abbreviation ?? "—", items };
    })
    .filter((t: TeamLeaders) => t.items.length);

  return teams.length ? teams : null;
}

export function parseSummary(raw: unknown, leagueCode: string): ParsedSummary {
  if (!raw || typeof raw !== "object") {
    return { lineScore: null, teamStats: null, leaders: null };
  }
  return {
    lineScore: parseLineScore(raw, leagueCode),
    teamStats: parseTeamStats(raw),
    leaders: parseLeaders(raw),
  };
}

/** Pull the ESPN summary out of a stored detailsJson value, tolerating both shapes. */
export function extractSummary(detailsJson: unknown): unknown {
  if (!detailsJson || typeof detailsJson !== "object") return null;
  const d = detailsJson as Record<string, unknown>;
  // Import/backfill store { scoreboard, summary }; be tolerant if a bare summary was stored.
  if (d.summary) return d.summary;
  if (d.boxscore || d.header) return d;
  return null;
}
