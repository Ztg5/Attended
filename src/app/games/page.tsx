import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAllGames } from "@/lib/stats";
import { requireUserId } from "@/lib/session";
import { GameLog } from "./GameLog";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const userId = await requireUserId();
  const games = await getAllGames(userId);
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
        <h1 className="text-2xl font-bold tracking-tight">Game log</h1>
        <p className="mt-1 text-sm text-muted">
          Every game, filterable and searchable. Tap a row for the venue, details, and the note.
        </p>
      </header>

      <GameLog games={games} leagues={leagues} />
    </main>
  );
}
