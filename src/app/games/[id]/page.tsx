import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Timer, MapPin, BarChart3, Star, UsersRound } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { parseSummary, extractSummary, type LineScore, type TeamLeaders } from "@/lib/summary";
import { getGamePlayers, statLabel, headlineStats, type GamePlayerLine } from "@/lib/players";
import { stateAbbr } from "@/lib/us-states";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import { FavoriteButton } from "@/components/FavoriteButton";

export const dynamic = "force-dynamic";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = Number(id);
  if (!Number.isFinite(gameId)) notFound();

  const userId = await requireUserId();
  const g = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
      venue: true,
      // Notes are private (only the current user's is shown). Other attendees are
      // listed by name only — never their notes.
      attendances: {
        select: { notes: true, favoritedAt: true, user: { select: { id: true, name: true, username: true, email: true } } },
      },
    },
  });
  if (!g) notFound();

  const mine = g.attendances.find((a) => a.user.id === userId);
  const myNote = mine?.notes ?? null;
  const alsoAttended = g.attendances
    .filter((a) => a.user.id !== userId)
    .map((a) => ({ name: a.user.name ?? a.user.email ?? "Someone", username: a.user.username }));

  const summary = extractSummary(g.detailsJson);
  const parsed = summary ? parseSummary(summary, g.league.code) : null;

  // "Who you saw" reads the lean Player tables, not detailsJson.
  const players = await getGamePlayers(gameId);
  const awayPlayers = players
    .filter((p) => p.teamId === g.awayTeamId)
    .sort((a, b) => Object.keys(b.stats).length - Object.keys(a.stats).length);
  const homePlayers = players
    .filter((p) => p.teamId === g.homeTeamId)
    .sort((a, b) => Object.keys(b.stats).length - Object.keys(a.stats).length);

  const date = g.date.toISOString().slice(0, 10);
  const homeWin = g.homeScore != null && g.awayScore != null && g.homeScore > g.awayScore;
  const awayWin = g.homeScore != null && g.awayScore != null && g.awayScore > g.homeScore;
  const otLabel = g.league.code === "MLB" ? "Extra innings" : "Overtime";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink fallback="/games" />
        <div className="flex items-center gap-2">
          {mine && <FavoriteButton gameId={g.id} initial={!!mine.favoritedAt} />}
        </div>
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

      {myNote && <p className="note mt-4 rounded-lg border border-border bg-surface px-5 py-4 leading-relaxed">{myNote}</p>}

      {alsoAttended.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-surface px-5 py-3 text-sm text-muted">
          <UsersRound size={14} className="text-faint" />
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Also attended by</span>
          {alsoAttended.map((a, i) => (
            <span key={i} className="font-medium text-ink">
              {a.username ? (
                <Link href={`/u/${a.username}`} className="hover:text-primary">
                  {a.name}
                </Link>
              ) : (
                a.name
              )}
              {i < alsoAttended.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      )}

      {/* Sections — only rendered when the data exists. Team stats intentionally omitted
          (too much data per game once every user sees it). */}
      {parsed?.lineScore && <LineScoreTable data={parsed.lineScore} />}
      {parsed?.leaders && <LeadersBlock teams={parsed.leaders} />}

      {players.length > 0 && (
        <section>
          <SectionHeading icon={<UsersRound size={15} />}>Who you saw</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlayerColumn abbr={g.awayTeam?.abbreviation ?? "AWAY"} players={awayPlayers} leagueCode={g.league.code} />
            <PlayerColumn abbr={g.homeTeam?.abbreviation ?? "HOME"} players={homePlayers} leagueCode={g.league.code} />
          </div>
        </section>
      )}

      {!parsed?.lineScore && !parsed?.leaders && (
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

function PlayerColumn({ abbr, players, leagueCode }: { abbr: string; players: GamePlayerLine[]; leagueCode: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {abbr}
      </div>
      <ul>
        {players.map((p) => {
          const entries = headlineStats(leagueCode, p.stats);
          return (
            <li key={p.playerId} className="flex items-start gap-2.5 border-b border-border px-4 py-2.5 last:border-0">
              <PlayerHeadshot url={p.headshotUrl} name={p.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <Link href={`/players/${p.playerId}`} className="truncate text-sm font-medium hover:text-primary">
                    {p.name}
                  </Link>
                  {p.position && <span className="shrink-0 text-xs text-faint">{p.position}</span>}
                </div>
                {entries.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted">
                    {entries.map(([k, v]) => (
                      <span key={k}>
                        <span className="tnum font-medium text-ink">{v}</span> {statLabel(k)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
