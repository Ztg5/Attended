import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogForm } from "./LogForm";
import type { TeamOpt } from "@/components/TeamPicker";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const teams = await prisma.team.findMany({
    include: { league: true },
    orderBy: { name: "asc" },
  });

  const teamsByLeague: Record<string, TeamOpt[]> = {};
  for (const t of teams) {
    (teamsByLeague[t.league.code] ??= []).push({
      id: t.id,
      name: t.name,
      nickname: t.nickname,
      abbreviation: t.abbreviation,
      logoUrl: t.logoUrl,
    });
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft size={15} /> Attended
        </Link>
        <ThemeToggle />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Log a game</h1>
        <p className="mt-1 text-sm text-muted">
          Pick the teams and date — I&apos;ll pull the result from ESPN for you to confirm.
        </p>
      </header>

      <LogForm teamsByLeague={teamsByLeague} />
    </main>
  );
}
