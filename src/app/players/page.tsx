import { getPlayersList } from "@/lib/players";
import { requireUserId } from "@/lib/session";
import { BackLink } from "@/components/BackLink";
import { PageMasthead } from "@/components/PageMasthead";
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

      <PageMasthead title="Players seen" />

      <PlayersGrid players={players} />
    </main>
  );
}
