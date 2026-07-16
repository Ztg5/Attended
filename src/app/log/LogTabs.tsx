"use client";

import { useState } from "react";
import { Search, CalendarRange } from "lucide-react";
import { LogForm } from "./LogForm";
import { ScheduleForm } from "../schedule/ScheduleForm";
import type { ScheduleTeamOpt } from "../schedule/page";

type Mode = "single" | "schedule";

/** Two ways to add games: one specific game, or many at once from a team's schedule. */
export function LogTabs({ teamsByLeague }: { teamsByLeague: Record<string, ScheduleTeamOpt[]> }) {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div>
      <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <OptionCard
          active={mode === "single"}
          onClick={() => setMode("single")}
          icon={<Search size={16} />}
          title="One game"
          desc="Pick the home team and date — I'll pull the matchup and result from ESPN."
        />
        <OptionCard
          active={mode === "schedule"}
          onClick={() => setMode("schedule")}
          icon={<CalendarRange size={16} />}
          title="A whole season"
          desc="Browse a team's schedule and check off every game you attended at once."
        />
      </div>

      {mode === "single" ? (
        <LogForm teamsByLeague={teamsByLeague} />
      ) : (
        <ScheduleForm teamsByLeague={teamsByLeague} />
      )}
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
        active
          ? "border-primary bg-primary-weak"
          : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      <span className={`flex items-center gap-2 text-sm font-semibold ${active ? "text-primary" : "text-ink"}`}>
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-xs text-muted">{desc}</span>
    </button>
  );
}
