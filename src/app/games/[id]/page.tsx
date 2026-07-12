import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy, Timer, MapPin, Users, BarChart3, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { parseSummary, extractSummary, type LineScore, type TeamStats, type TeamLeaders } from "@/lib/summary";
import { stateAbbr } from "@/lib/us-states";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TeamLogo } from "@/components/TeamLogo";

export const dynamic = "force-dynamic";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  if (!Number.isFinite(gameId)) notFound();

  const g = await prisma.game.findUnique({
    where: { id: gameId },
    include: { league: true, homeTeam: true, awayTeam: true, venue: true },
  });
  if (!g) notFound();

  const summary = extractSummary(g.detailsJson);
  const parsed = summary ? parseSummary(summary, g.league.code) : null;

  const date = g.date.toISOString().slice(0, 10);
  const homeWin = g.homeScore != null && g.awayScore != null && g.homeScore > g.awayScore;
  const awayWin = g.homeScore != null && g.awayScore != null && g.awayScore > g.homeScore;
  const otLabel = g.league.code === "MLB" ? "Extra innings" : "Overtime";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <Link href="/games" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft size={15} /> Game log
        </Link>
        <ThemeToggle />
      </div>

      {/* Scoreboard header */}
      <header className="mt-4 rounded-lg border border-border bg-surface px-5 py-6">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="tnum">{date}</span>
          <span className="rounded bg-bg px-1.5 py-0.5 font-medium uppercase tracking-wide ring-1 ring-border">{g.league.code}</span>
          {g.isPostseason && (
            <span className="inline-flex items-center gap-1" style={{ color: "var(--gold)" }}>
              <Trophy size={12} /> {g.postseasonRound ?? "Playoffs"}
            </span>
          )}
          {g.wentToOvertime && (
            <span className="inline-flex items-center gap-1">
              <Timer size={12} /> {otLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamSide
            name={g.awayTeam?.name ?? "Away"}
            abbr={g.awayTeam?.abbreviation ?? "—"}
            logo={g.awayTeam?.logoUrl ?? null}
            score={g.awayScore}
            win={awayWin}
            align="end"
          />
          <span className="text-sm text-faint">final</span>
          <TeamSide
            name={g.homeTeam?.name ?? "Home"}
            abbr={g.homeTeam?.abbreviation ?? "—"}
            logo={g.homeTeam?.logoUrl ?? null}
            score={g.homeScore}
            win={homeWin}
            align="start"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
          {g.venue?.name && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {g.venue.name}
              {g.venue.city ? `, ${g.venue.city}${g.venue.state ? ", " + stateAbbr(g.venue.state) : ""}` : ""}
            </span>
          )}
          {g.attendance != null && <span className="tnum">att {g.attendance.toLocaleString()}</span>}
        </div>
      </header>

      {g.notes && <p className="note mt-4 rounded-lg border border-border bg-surface px-5 py-4 leading-relaxed">{g.notes}</p>}

      {/* Sections — only rendered when the data exists */}
      {parsed?.lineScore && <LineScoreTable data={parsed.lineScore} />}
      {parsed?.teamStats && <TeamStatsTable data={parsed.teamStats} />}
      {parsed?.leaders && <LeadersBlock teams={parsed.leaders} />}

      {!parsed?.lineScore && !parsed?.teamStats && !parsed?.leaders && (
        <div className="mt-6 rounded-lg border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
          Detailed stats aren&apos;t loaded for this game yet.
          <span className="mt-1 block text-faint">Run the summary backfill to populate the box score.</span>
        </div>
      )}
    </main>
  );
}

function TeamSide({
  name,
  abbr,
  logo,
  score,
  win,
  align,
}: {
  name: string;
  abbr: string;
  logo: string | null;
  score: number | null;
  win: boolean;
  align: "start" | "end";
}) {
  return (
    <div className={`flex items-center gap-3 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      <TeamLogo url={logo} alt={name} size={44} />
      <div className={align === "end" ? "items-end" : ""}>
        <div className="text-sm font-medium leading-tight">{abbr}</div>
        <div className={`tnum text-4xl font-semibold leading-none ${win ? "" : "text-muted"}`}>{score ?? "–"}</div>
      </div>
    </div>
  );
}

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
      {icon}
      {children}
    </h2>
  );
}

function LineScoreTable({ data }: { data: LineScore }) {
  return (
    <section>
      <SectionHeading icon={<BarChart3 size={15} />}>Line score</SectionHeading>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-3 py-2 text-left font-medium">Team</th>
              {data.periodLabels.map((l) => (
                <th key={l} className="tnum w-8 px-1 py-2 text-center font-medium">{l}</th>
              ))}
              <th className="tnum w-9 px-2 py-2 text-center font-semibold text-ink">{data.showHitsErrors ? "R" : "T"}</th>
              {data.showHitsErrors && <th className="tnum w-9 px-1 py-2 text-center font-medium">H</th>}
              {data.showHitsErrors && <th className="tnum w-9 px-1 py-2 text-center font-medium">E</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.abbr + r.homeAway} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{r.abbr}</td>
                {data.periodLabels.map((_, i) => (
                  <td key={i} className="tnum px-1 py-2 text-center text-muted">{r.periods[i] ?? ""}</td>
                ))}
                <td className="tnum px-2 py-2 text-center font-semibold">{r.total}</td>
                {data.showHitsErrors && <td className="tnum px-1 py-2 text-center text-muted">{r.hits}</td>}
                {data.showHitsErrors && <td className="tnum px-1 py-2 text-center text-muted">{r.errors}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamStatsTable({ data }: { data: TeamStats }) {
  return (
    <section>
      <SectionHeading icon={<Users size={15} />}>Team stats</SectionHeading>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-4 py-2 text-xs font-medium text-muted">
          <span />
          <span className="tnum w-14 text-center">{data.awayAbbr}</span>
          <span className="tnum w-14 text-center">{data.homeAbbr}</span>
        </div>
        {data.groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <div className="border-b border-border bg-surface-2 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </div>
            )}
            {group.rows.map((row, ri) => (
              <div
                key={ri}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-border px-4 py-2 text-sm last:border-0"
              >
                <span className="text-muted">{row.label}</span>
                <span className="tnum w-14 text-center">{row.away}</span>
                <span className="tnum w-14 text-center">{row.home}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LeadersBlock({ teams }: { teams: TeamLeaders[] }) {
  return (
    <section>
      <SectionHeading icon={<Star size={15} />}>Game leaders</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((team) => (
          <div key={team.abbr} className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {team.abbr}
            </div>
            <ul>
              {team.items.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2 text-sm last:border-0">
                  <span className="min-w-0">
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-1.5 text-xs text-faint">{item.category}</span>
                  </span>
                  <span className="tnum shrink-0 font-medium">{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
