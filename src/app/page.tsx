import Link from "next/link";
import { ClipboardCheck, ArrowRight, Flame, PlusCircle, LayoutGrid, Users, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { getDashboard } from "@/lib/stats";
import { requireUserId } from "@/lib/session";
import { ButtonLink } from "@/components/Button";
import { UserMenu } from "@/components/UserMenu";
import { TeamLogo } from "@/components/TeamLogo";
import { GameRow } from "@/components/GameRow";
import { PendingRefresh } from "@/components/PendingRefresh";
import { RecordsCarousel } from "@/components/RecordsCarousel";
import { FavoritePrompt } from "@/components/FavoritePrompt";

// Render on demand (not prerendered at build) so deploys never depend on the DB
// being reachable. Queries are trimmed (see stats.ts) so per-request cost is small.
export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await requireUserId();
  const [d, needsReview, pendingCount, friendRequests] = await Promise.all([
    getDashboard(userId),
    prisma.game.count({ where: { status: "needs_review", attendances: { some: { userId } } } }),
    prisma.game.count({ where: { status: "pending", attendances: { some: { userId } } } }),
    prisma.friendship.count({ where: { addresseeId: userId, status: "pending" } }),
  ]);

  const rec = (w: number, l: number, t: number) => (t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`);
  const pct = (w: number, l: number) => (w + l ? Math.round((w / (w + l)) * 100) : 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Masthead */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attended</h1>
          <p className="mt-1 text-sm text-muted">
            Every professional sporting event I&apos;ve attended.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {needsReview > 0 && (
            <ButtonLink href="/review" variant="secondary">
              <ClipboardCheck size={15} style={{ color: "var(--review)" }} />
              <span className="tnum">{needsReview}</span> to review
            </ButtonLink>
          )}
          <ButtonLink href="/collection" variant="secondary">
            <LayoutGrid size={15} /> Collection
          </ButtonLink>
          <ButtonLink href="/players" variant="secondary">
            <Users size={15} /> Players
          </ButtonLink>
          <ButtonLink href="/people" variant="secondary">
            <UserRound size={15} /> People
            {friendRequests > 0 && (
              <span className="tnum ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--primary)", color: "var(--on-primary)" }}>
                {friendRequests}
              </span>
            )}
          </ButtonLink>
          <ButtonLink href="/log" variant="primary">
            <PlusCircle size={15} /> Log a game
          </ButtonLink>
          <UserMenu />
        </div>
      </div>

      {pendingCount > 0 && <PendingRefresh count={pendingCount} />}

      {d.totalGames > 0 && d.favoritesCount === 0 && <FavoritePrompt />}

      {/* Headline band — every box links somewhere except the record. */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Games" value={d.totalGames} href="/games" />
        <Stat label="Record attending" value={rec(d.overall.wins, d.overall.losses, d.overall.ties)} sub={`${pct(d.overall.wins, d.overall.losses)}% W`} />
        <Stat label="Venues" value={d.venuesVisited} href="/collection" />
        <Stat label="Playoff games" value={d.playoffCount} href="/games?filter=playoffs" />
        <Stat label="Win streak" value={d.currentWinStreak} icon={<Flame size={14} />} sub="current" href="/games?streak=current" />
        <Stat label="Longest streak" value={d.longestWinStreak} sub="wins in a row" href="/games?streak=longest" />
      </section>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted">
        {d.perLeague.map((l) => (
          <span key={l.code}>
            <span className="font-medium text-ink">{l.code}</span>{" "}
            <span className="tnum">{l.count}</span>
          </span>
        ))}
      </p>

      {/* Followed teams — each row links to that team's game log. */}
      <Section
        title="By team"
        hint="Your record with your teams"
        action={
          <Link href="/choose-teams" className="text-sm text-primary hover:text-primary-hover">
            Edit
          </Link>
        }
      >
        {d.followed.length > 0 ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {d.followed.map((f) => (
              <Link key={f.team.id} href={`/games?team=${f.team.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                <TeamLogo url={f.team.logoUrl} alt={f.team.name} size={30} />
                <span className="font-medium">{f.team.name}</span>
                <span className="ml-auto flex items-baseline gap-3">
                  <span className="tnum text-lg font-semibold">{rec(f.wins, f.losses, f.ties)}</span>
                  <span className="tnum w-12 text-right text-sm text-muted">{pct(f.wins, f.losses)}%</span>
                  <span className="tnum w-16 text-right text-xs text-faint">{f.games} games</span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href="/choose-teams"
            className="block rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted transition-colors hover:bg-surface-2"
          >
            Pick your favorite teams to track your record with them →
          </Link>
        )}
      </Section>

      {/* Personal records — carousel: first games, then per-league records. */}
      <section className="mt-8">
        <RecordsCarousel firstByLeague={d.records.firstByLeague} perLeague={d.records.perLeague} />
      </section>

      {/* Recent games */}
      <Section
        title="Recent games"
        action={
          <Link href="/games" className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover">
            Full log <ArrowRight size={14} />
          </Link>
        }
      >
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {d.recentGames.map((g) => (
            <GameRow key={g.id} g={g} />
          ))}
        </div>
      </Section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-2xl font-semibold leading-none">{value}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {sub && <div className="tnum text-[11px] text-faint">{sub}</div>}
    </>
  );
  const cls = "bg-bg px-4 py-3.5";
  return href ? (
    <Link href={href} className={`${cls} block transition-colors hover:bg-surface`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
          {hint && <span className="ml-2 font-normal normal-case tracking-normal text-faint">{hint}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
