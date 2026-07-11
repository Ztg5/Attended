import { TeamLogo } from "./TeamLogo";
import type { GameLite } from "@/lib/stats";

/** Compact away @ home line with logos; winner emphasized, loser muted. */
export function GameLine({ g, size = 24 }: { g: GameLite; size?: number }) {
  const decided = g.homeScore != null && g.awayScore != null;
  const homeWin = decided && (g.homeScore as number) > (g.awayScore as number);
  const awayWin = decided && (g.awayScore as number) > (g.homeScore as number);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <TeamLogo url={g.away?.logoUrl ?? null} alt={g.away?.name ?? "away"} size={size} />
      <span className={awayWin ? "font-semibold" : "text-muted"}>{g.away?.abbreviation ?? "—"}</span>
      <span className={`tnum tabular-nums ${awayWin ? "font-semibold" : "text-muted"}`}>
        {g.awayScore ?? "–"}
      </span>
      <span className="px-0.5 text-faint">@</span>
      <TeamLogo url={g.home?.logoUrl ?? null} alt={g.home?.name ?? "home"} size={size} />
      <span className={homeWin ? "font-semibold" : "text-muted"}>{g.home?.abbreviation ?? "—"}</span>
      <span className={`tnum tabular-nums ${homeWin ? "font-semibold" : "text-muted"}`}>
        {g.homeScore ?? "–"}
      </span>
    </div>
  );
}
