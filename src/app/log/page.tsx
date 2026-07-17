import { prisma } from "@/lib/db";
import { BackLink } from "@/components/BackLink";
import { LogTabs } from "./LogTabs";
import type { ScheduleTeamOpt } from "../schedule/page";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const teams = await prisma.team.findMany({
    include: { league: true },
    orderBy: { name: "asc" },
  });

  const teamsByLeague: Record<string, ScheduleTeamOpt[]> = {};
  for (const t of teams) {
    (teamsByLeague[t.league.code] ??= []).push({
      id: t.id,
      name: t.name,
      nickname: t.nickname,
      abbreviation: t.abbreviation,
      logoUrl: t.logoUrl,
      espnTeamId: t.espnTeamId,
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Add games</h1>
        <p className="mt-1 text-sm text-muted">
          Two ways to add games you&apos;ve been to — one at a time, or a whole team&apos;s season at once.
        </p>
      </header>

      <LogTabs teamsByLeague={teamsByLeague} />
    </main>
  );
}
