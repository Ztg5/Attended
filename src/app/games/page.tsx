import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getAllGames, getTeamGames, getStreakGames, type GameLite } from "@/lib/stats";
import { requireUserId } from "@/lib/session";
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
  let subtitle = "Every game, filterable and searchable. Tap a row for the venue, details, and the note.";

  const teamId = sp.team ? Number(sp.team) : null;
  if (teamId && Number.isFinite(teamId)) {
    const [g, team] = await Promise.all([
      getTeamGames(userId, teamId),
      prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    ]);
    games = g;
    title = team ? `${team.name} games` : "Team games";
    subtitle = "Every game you attended with this team.";
  } else if (sp.filter === "playoffs") {
    games = (await getAllGames(userId)).filter((g) => g.isPostseason);
    title = "Playoff games";
    subtitle = "Every postseason game you attended.";
  } else if (sp.streak === "current" || sp.streak === "longest") {
    games = await getStreakGames(userId, sp.streak);
    title = sp.streak === "current" ? "Current win streak" : "Longest win streak";
    subtitle = "The games in this run of wins with your favorite teams.";
  } else {
    games = await getAllGames(userId);
  }

  const leagues = [...new Set(games.map((g) => g.leagueCode))].sort();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Attended
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </header>

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
