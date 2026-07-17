import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { getPlayerDetail, statLabel, headlineStats } from "@/lib/players";
import { requireUserId } from "@/lib/session";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isFinite(playerId)) notFound();

  const userId = await requireUserId();
  const p = await getPlayerDetail(playerId, userId);
  if (!p) notFound();

  const rec = `${p.record.wins}–${p.record.losses}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink fallback="/players" />
      </div>

      {/* Header */}
      <header className="mt-4 flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-5">
        <PlayerHeadshot url={p.headshotUrl} name={p.name} size={64} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
            {p.position && <span>{p.position}</span>}
            <span>
              Seen <span className="tnum font-medium text-ink">{p.totalGames}</span> time
              {p.totalGames === 1 ? "" : "s"}
            </span>
            {p.record.wins + p.record.losses > 0 && (
              <span>
                Their team: <span className="tnum font-medium text-ink">{rec}</span> when you attended
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Data-coverage note */}
      {p.totalGames > 0 && (
        <p className="mt-2 px-1 text-xs text-muted">
          Stats available for <span className="tnum">{p.statsAvailable}</span> of{" "}
          <span className="tnum">{p.totalGames}</span> games
          {p.statsAvailable < p.totalGames ? " (older games often have no box score)." : "."}
        </p>
      )}

      {/* Career totals across attended games */}
      {p.totals.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <TrendingUp size={15} /> Totals in games you attended
          </h2>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {p.totals.map((t) => (
              <div key={t.key} className="bg-bg px-3 py-2.5">
                <div className="tnum text-lg font-semibold leading-none">{t.total}</div>
                <div className="mt-1 text-xs text-muted">{statLabel(t.key)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Games seen */}
      <section className="mt-8">
        <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted">Games you saw them</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {p.games.map((g) => {
            const entries = headlineStats(g.leagueCode, g.stats);
            return (
              <Link
                key={g.gameId}
                href={`/games/${g.gameId}`}
                className="block border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="tnum w-[4.5rem] shrink-0 text-xs text-muted">{g.date}</span>
                  <span className="font-medium">
                    {g.awayAbbr} <span className="tnum text-muted">{g.awayScore ?? "–"}</span>
                    <span className="px-1 text-faint">@</span>
                    {g.homeAbbr} <span className="tnum text-muted">{g.homeScore ?? "–"}</span>
                  </span>
                  {g.won !== null && (
                    <span
                      className="tnum ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: g.won ? "var(--win)" : "var(--loss)",
                        color: g.won ? "var(--on-win)" : "var(--on-loss)",
                      }}
                    >
                      {g.won ? "W" : "L"}
                    </span>
                  )}
                  <span className="ml-auto text-xs uppercase tracking-wide text-faint">{g.leagueCode}</span>
                </div>
                {entries.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-[4.5rem] text-xs text-muted">
                    {entries.map(([k, v]) => (
                      <span key={k}>
                        <span className="tnum font-medium text-ink">{v}</span> {statLabel(k)}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
