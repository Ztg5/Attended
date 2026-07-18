import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, Lock, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getProfile } from "@/lib/social";
import { getBannerTeam } from "@/lib/stats";
import { GameLine } from "@/components/GameLine";
import { ZubazBanner } from "@/components/ZubazBanner";
import { FriendButton } from "@/components/FriendButton";
import { BackLink } from "@/components/BackLink";
import { ShareLink } from "@/components/ShareLink";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const rec = (w: number, l: number, t: number) => (t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`);

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewerId = await requireUserId();
  const profile = await getProfile(username.toLowerCase(), viewerId);
  if (!profile) notFound();

  const { user, status, full } = profile;
  const display = user.username ? `@${user.username}` : user.name ?? "User";

  // Gated behind `full` so a locked profile doesn't hint at their team.
  const bannerTeam = full ? await getBannerTeam(user.id) : null;

  // Only your own share token is ever read — never another user's.
  const shareToken =
    status === "self"
      ? (await prisma.user.findUnique({ where: { id: viewerId }, select: { shareToken: true } }))
          ?.shareToken ?? null
      : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink fallback="/people" />
        {status === "self" && <SignOutButton />}
      </div>

      {/* Header — Zubaz band in the colors of the team they've seen most. */}
      <header className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        {bannerTeam && (
          <ZubazBanner primary={bannerTeam.primaryColor} secondary={bannerTeam.secondaryColor} />
        )}
        <div className="flex items-center gap-4 px-5 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl font-semibold text-muted">
          {(user.username ?? user.name ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="nameplate truncate text-[1.75rem] leading-none">{display}</h1>
          {user.name && user.username && <p className="text-sm text-muted">{user.name}</p>}
        </div>
        {status === "self" ? (
          <ShareLink initialToken={shareToken} displayName={user.name ?? display} />
        ) : (
          <FriendButton targetId={user.id} status={status} size="md" />
        )}
        </div>
      </header>

      {!full ? (
        <div className="mt-6 rounded-lg border border-border bg-surface px-5 py-10 text-center">
          <Lock size={28} className="mx-auto mb-3 text-faint" />
          <p className="text-sm text-muted">
            Add {display} as a friend to see their games, records, and collection.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <section className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <Stat label="Games" value={full.stats.totalGames} />
            <Stat label="Record attending" value={rec(full.stats.record.wins, full.stats.record.losses, full.stats.record.ties)} />
            <Stat label="Venues" value={full.stats.venuesVisited} />
          </section>

          {/* Shared games */}
          {status === "friends" && full.sharedCount > 0 && (
            <Link
              href={`/u/${user.username}/shared`}
              className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2"
            >
              <Users size={18} className="text-primary" />
              <span className="text-sm">
                You both attended <span className="tnum font-semibold">{full.sharedCount}</span> game
                {full.sharedCount === 1 ? "" : "s"}
              </span>
              <ArrowRight size={16} className="ml-auto text-faint" />
            </Link>
          )}

          {/* Favorite games */}
          <section className="mt-8">
            <h2 className="section-head mb-3">
              <span className="shrink-0 text-[15px] font-semibold text-ink">Favorite games</span>
              <span className="rule" />
            </h2>
            {full.favorites.length ? (
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {full.favorites.map((g) => (
                  <Link key={g.id} href={`/games/${g.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                    <span className="tnum w-[4.5rem] shrink-0 text-xs text-muted">{g.date}</span>
                    <GameLine g={g} size={22} />
                    <span className="ml-auto text-xs uppercase tracking-wide text-faint">{g.leagueCode}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
                No favorite games picked yet.
              </div>
            )}
          </section>

          {/* Collection preview */}
          <section className="mt-8">
            <h2 className="section-head mb-3">
              <span className="shrink-0 text-[15px] font-semibold text-ink">Collection</span>
              <span className="rule" />
            </h2>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {full.collection.map((c) => (
                <Link key={c.code} href={`/u/${user.username}/collection`} className="bg-bg px-4 py-3 transition-colors hover:bg-surface">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">{c.code}</div>
                  <div className="tnum mt-1 text-lg font-semibold leading-none">
                    {c.seen}
                    <span className="text-sm font-normal text-faint">/{c.total}</span>
                  </div>
                  <div className="text-[11px] text-faint">teams seen</div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg px-4 py-3.5">
      <div className="tnum text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-xs font-medium text-muted">{label}</div>
    </div>
  );
}
