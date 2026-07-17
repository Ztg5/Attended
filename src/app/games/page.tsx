import { prisma } from "@/lib/db";
import { getAllGames, getTeamGames, getStreakGames, type GameLite } from "@/lib/stats";
import { requireUserId } from "@/lib/session";
import { BackLink } from "@/components/BackLink";
import { PageMasthead } from "@/components/PageMasthead";
import { GameLog } from "./GameLog";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; filter?: string; streak?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;

  let games: GameLite[];
  let title = "Game log";

  const teamId = sp.team ? Number(sp.team) : null;
  if (teamId && Number.isFinite(teamId)) {
    const [g, team] = await Promise.all([
      getTeamGames(userId, teamId),
      prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    ]);
    games = g;
    title = team ? `${team.name} games` : "Team games";
  } else if (sp.filter === "playoffs") {
    games = (await getAllGames(userId)).filter((g) => g.isPostseason);
    title = "Playoff games";
  } else if (sp.streak === "current" || sp.streak === "longest") {
    games = await getStreakGames(userId, sp.streak);
    title = sp.streak === "current" ? "Current win streak" : "Longest win streak";
  } else {
    games = await getAllGames(userId);
  }

  const leagues = [...new Set(games.map((g) => g.leagueCode))].sort();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink />
      </div>

      <PageMasthead title={title} />

      {games.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          No games here yet.
        </div>
      ) : (
        <GameLog games={games} leagues={leagues} />
      )}
    </main>
  );
}
