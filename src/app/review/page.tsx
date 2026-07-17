import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { BackLink } from "@/components/BackLink";
import { PageMasthead } from "@/components/PageMasthead";
import { ReviewGame, type GameVM, type TeamOpt } from "./ReviewGame";

export const dynamic = "force-dynamic"; // always reflect the latest DB state

export default async function ReviewPage() {
  const userId = await requireUserId();
  const games = await prisma.game.findMany({
    where: { status: "needs_review", attendances: { some: { userId } } },
    // select (not include) so the heavy detailsJson blob is never pulled here.
    select: {
      id: true,
      leagueId: true,
      seasonYear: true,
      date: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      status: true,
      matchNote: true,
      claimedResult: true,
      isPostseason: true,
      postseasonRound: true,
      attendance: true,
      league: { select: { code: true } },
      venue: { select: { name: true } },
      attendances: { where: { userId }, select: { notes: true } },
    },
    orderBy: { date: "desc" },
  });

  const leagueIds = [...new Set(games.map((g) => g.leagueId))];
  const teams = await prisma.team.findMany({
    where: { leagueId: { in: leagueIds.length ? leagueIds : [-1] } },
    orderBy: [{ leagueId: "asc" }, { name: "asc" }],
  });
  const teamsByLeague = new Map<number, TeamOpt[]>();
  for (const t of teams) {
    const list = teamsByLeague.get(t.leagueId) ?? [];
    list.push({ id: t.id, name: t.name, nickname: t.nickname, logoUrl: t.logoUrl });
    teamsByLeague.set(t.leagueId, list);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink />
      </div>

      <PageMasthead
        title="Review"
        subtitle={
          games.length > 0 ? (
            <>
              <span className="tnum font-medium not-italic text-ink">{games.length}</span> game
              {games.length === 1 ? "" : "s"} flagged during import. Confirm or fix each, then
              mark it reviewed.
            </>
          ) : (
            "Nothing to review — every game is confirmed."
          )
        }
      />

      {games.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface px-5 py-12 text-center text-muted">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-faint" />
          All clear. The data foundation is verified.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {games.map((g) => {
            const vm: GameVM = {
              id: g.id,
              leagueCode: g.league.code,
              date: g.date.toISOString().slice(0, 10),
              seasonYear: g.seasonYear,
              homeTeamId: g.homeTeamId,
              awayTeamId: g.awayTeamId,
              homeScore: g.homeScore,
              awayScore: g.awayScore,
              status: g.status,
              notes: g.attendances[0]?.notes ?? "",
              matchNote: g.matchNote,
              claimedResult: g.claimedResult,
              venueName: g.venue?.name ?? null,
              isPostseason: g.isPostseason,
              postseasonRound: g.postseasonRound,
              attendance: g.attendance,
            };
            return <ReviewGame key={g.id} game={vm} teams={teamsByLeague.get(g.leagueId) ?? []} />;
          })}
        </div>
      )}
    </main>
  );
}
