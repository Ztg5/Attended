import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { LeagueCode } from "./espn/client";
import { SeedRow } from "./matching";

const LEAGUES = new Set<LeagueCode>(["NFL", "MLB", "NBA", "NHL"]);

/** Read seed-games.csv into SeedRow[]. Throws on an unknown league code. */
export function readSeedGames(path: string): SeedRow[] {
  const text = readFileSync(path, "utf8");
  const records: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((r, i) => {
    const league = r.league?.toUpperCase() as LeagueCode;
    if (!LEAGUES.has(league)) {
      throw new Error(`Row ${i + 2}: unknown league "${r.league}"`);
    }
    return {
      league,
      date: r.date ? r.date : null,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      venueOverride: r.venue_override || null,
      claimedResult: r.claimed_result || null,
      notes: r.notes || null,
      needsReview: (r.needs_review || "").toLowerCase() === "yes",
    };
  });
}
