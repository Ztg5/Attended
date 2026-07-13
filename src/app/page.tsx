import Link from "next/link";
import { ClipboardCheck, ArrowRight, Flame, Trophy, Zap, Crosshair, Plane, PlusCircle, LayoutGrid, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getDashboard, type GameLite } from "@/lib/stats";
import { ButtonLink } from "@/components/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TeamLogo } from "@/components/TeamLogo";
import { GameLine } from "@/components/GameLine";
import { GameRow } from "@/components/GameRow";
import { PendingRefresh } from "@/components/PendingRefresh";

// Render on demand (not prerendered at build) so deploys never depend on the DB
// being reachable. Queries are trimmed (see stats.ts) so per-request cost is small.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [d, needsReview, pendingCount] = await Promise.all([
    getDashboard(),
    prisma.game.count({ where: { status: "needs_review" } }),
    prisma.game.count({ where: { status: "pending" } }),
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
          <ButtonLink href="/log" variant="primary">
            <PlusCircle size={15} /> Log a game
          </ButtonLink>
          <ThemeToggle />
        </div>
      </div>

      {pendingCount > 0 && <PendingRefresh count={pendingCount} />}

      {/* Headline band */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Games" value={d.totalGames} />
        <Stat label="Record attending" value={rec(d.overall.wins, d.overall.losses, d.overall.ties)} sub={`${pct(d.overall.wins, d.overall.losses)}% W`} />
        <Stat label="Venues" value={d.venuesVisited} />
        <Stat label="Playoff games" value={d.records.playoffCount} />
        <Stat label="Win streak" value={d.currentWinStreak} icon={<Flame size={14} />} sub="current" />
        <Stat label="Longest streak" value={d.longestWinStreak} sub="wins in a row" />
      </section>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-muted">
        {d.perLeague.map((l) => (
          <span key={l.code}>
            <span className="font-medium text-ink">{l.code}</span>{" "}
            <span className="tnum">{l.count}</span>
          </span>
        ))}
      </p>

      {/* Followed teams */}
      <Section title="By team" hint="Your record with your teams">
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {d.followed.map((f) => (
            <div key={f.team.id} className="flex items-center gap-3 px-4 py-3">
              <TeamLogo url={f.team.logoUrl} alt={f.team.name} size={30} />
              <span className="font-medium">{f.team.name}</span>
              <span className="ml-auto flex items-baseline gap-3">
                <span className="tnum text-lg font-semibold">{rec(f.wins, f.losses, f.ties)}</span>
                <span className="tnum w-12 text-right text-sm text-muted">{pct(f.wins, f.losses)}%</span>
                <span className="tnum w-16 text-right text-xs text-faint">{f.games} games</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Personal records */}
      <Section title="Personal records">
        <div className="grid gap-3 sm:grid-cols-2">
          <RecordCard icon={<Zap size={15} />} label="Biggest blowout" g={d.records.biggestBlowout} detail={(g) => `${Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0))}-pt margin`} />
          <RecordCard icon={<Trophy size={15} />} label="Highest scoring" g={d.records.highestScoring} detail={(g) => `${(g.homeScore ?? 0) + (g.awayScore ?? 0)} combined`} />
          <RecordCard icon={<Crosshair size={15} />} label="Closest game" g={d.records.closest} detail={(g) => `${Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0))}-pt margin`} />
          <RecordCard icon={<Plane size={15} />} label="First road trip" g={d.records.firstRoad} detail={(g) => g.date} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {d.records.firstByLeague.map((f) => (
            <RecordCard key={f.code} label={`First ${f.code}`} g={f.game} detail={(g) => g.date} compact />
          ))}
        </div>
      </Section>

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
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-bg px-4 py-3.5">
      <div className="flex items-baseline gap-1.5">
        <span className="tnum text-2xl font-semibold leading-none">{value}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className="mt-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {sub && <div className="tnum text-[11px] text-faint">{sub}</div>}
    </div>
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

function RecordCard({
  icon,
  label,
  g,
  detail,
  compact = false,
}: {
  icon?: React.ReactNode;
  label: string;
  g: GameLite | null;
  detail: (g: GameLite) => string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon}
        {label}
      </div>
      {g ? (
        <>
          <GameLine g={g} size={compact ? 20 : 24} />
          <div className="tnum mt-1.5 text-xs text-faint">{detail(g)}</div>
        </>
      ) : (
        <div className="text-sm text-faint">—</div>
      )}
    </div>
  );
}
