import { Users } from "lucide-react";
import { getPlayersList } from "@/lib/players";
import { requireUserId } from "@/lib/session";
import { BackLink } from "@/components/BackLink";
import { PlayersGrid } from "./PlayersGrid";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const userId = await requireUserId();
  const players = await getPlayersList(userId);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink />
      </div>

      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <Users size={24} className="text-primary" />
          Players seen
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every player who appeared in a box score of a game you attended.
        </p>
      </header>

      <PlayersGrid players={players} />
    </main>
  );
}
