import { prisma } from "@/lib/db";
import { BackLink } from "@/components/BackLink";
import { requireUserId } from "@/lib/session";
import { ChooseTeams, type LeagueTeams } from "./ChooseTeams";

export const dynamic = "force-dynamic";

const LEAGUE_ORDER = ["NFL", "MLB", "NBA", "NHL"];

export default async function ChooseTeamsPage({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const userId = await requireUserId();
  const onboarding = (await searchParams).onboarding === "1";

  const [teams, me] = await Promise.all([
    prisma.team.findMany({
      include: { league: { select: { code: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { favoriteTeams: { select: { id: true } } } }),
  ]);

  const byLeague = new Map<string, LeagueTeams>();
  for (const t of teams) {
    const code = t.league.code;
    if (!byLeague.has(code)) byLeague.set(code, { code, teams: [] });
    byLeague.get(code)!.teams.push({ id: t.id, name: t.name, abbreviation: t.abbreviation, logoUrl: t.logoUrl });
  }
  const leagues = [...byLeague.values()].sort(
    (a, b) => LEAGUE_ORDER.indexOf(a.code) - LEAGUE_ORDER.indexOf(b.code)
  );
  const initialSelected = (me?.favoriteTeams ?? []).map((t) => t.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {!onboarding && (
        <div className="mb-1">
          <BackLink />
        </div>
      )}

      <header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {onboarding ? "Who do you root for?" : "Your favorite teams"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick your teams — your win/loss record and streaks are tracked from their games. Change them anytime.
        </p>
      </header>

      <ChooseTeams leagues={leagues} initialSelected={initialSelected} onboarding={onboarding} />
    </main>
  );
}
