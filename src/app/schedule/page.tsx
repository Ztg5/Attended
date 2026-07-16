import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ScheduleForm } from "./ScheduleForm";
import type { TeamOpt } from "@/components/TeamPicker";

export const dynamic = "force-dynamic";

export interface ScheduleTeamOpt extends TeamOpt {
  espnTeamId: string;
}

export default async function SchedulePage() {
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
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft size={15} /> Attended
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a team and season, then check off every game you attended to add them all at once.
        </p>
      </header>

      <ScheduleForm teamsByLeague={teamsByLeague} />
    </main>
  );
}
