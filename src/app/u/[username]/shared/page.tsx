import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { getSharedGamesView } from "@/lib/social";
import { GameLine } from "@/components/GameLine";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";

const rec = (w: number, l: number, t: number) => (t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`);

export default async function SharedGamesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewerId = await requireUserId();
  const view = await getSharedGamesView(viewerId, username.toLowerCase());
  if (!view) notFound(); // no such user, or not friends

  const display = view.target.username ? `@${view.target.username}` : view.target.name ?? "User";
  const { record } = view;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink fallback={`/u/${view.target.username}`} />
      </div>

      <header className="mb-6 mt-4">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <Users size={24} className="text-primary" /> Games you both attended
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every game you and {display} were both at.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        <Stat label="Shared games" value={view.games.length} />
        <Stat label="Combined record" value={rec(record.wins, record.losses, record.ties)} />
      </section>

      <div className="mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {view.games.map((g) => (
          <Link key={g.id} href={`/games/${g.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
            <span className="tnum w-[4.5rem] shrink-0 text-xs text-muted">{g.date}</span>
            <GameLine g={g} size={22} />
            <span className="ml-auto text-xs uppercase tracking-wide text-faint">{g.leagueCode}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg px-4 py-3.5">
      <div className="tnum text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
