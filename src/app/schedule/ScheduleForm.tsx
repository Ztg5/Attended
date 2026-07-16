"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, ListChecks, PlusCircle, Trophy } from "lucide-react";
import { TeamPicker } from "@/components/TeamPicker";
import { TeamLogo } from "@/components/TeamLogo";
import { Button, ButtonLink } from "@/components/Button";
import { getTeamSchedule, batchAddGames, type ScheduleGameItem } from "./actions";
import type { ScheduleTeamOpt } from "./page";

const LEAGUES = ["NFL", "MLB", "NBA", "NHL"] as const;

function seasonOptions(): number[] {
  const max = new Date().getFullYear() + 1; // include the upcoming season
  const min = 2010;
  return Array.from({ length: max - min + 1 }, (_, i) => max - i);
}

export function ScheduleForm({ teamsByLeague }: { teamsByLeague: Record<string, ScheduleTeamOpt[]> }) {
  const [league, setLeague] = useState<string>("NFL");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [season, setSeason] = useState(new Date().getFullYear());

  const [schedule, setSchedule] = useState<ScheduleGameItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number; message: string } | null>(null);
  const [pending, start] = useTransition();

  const teams = teamsByLeague[league] ?? [];
  const team = teams.find((t) => t.id === teamId) ?? null;
  const canView = teamId != null;

  function resetLeague(l: string) {
    setLeague(l);
    setTeamId(null);
    setError(null);
  }

  function viewSchedule() {
    if (!team) return;
    setError(null);
    start(async () => {
      const rows = await getTeamSchedule(league, team.espnTeamId, season);
      if (!rows.length) {
        setError("No schedule found for that team and season.");
        return;
      }
      setSchedule(rows);
      setSelected(new Set());
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    if (!team || selected.size === 0) return;
    start(async () => {
      const r = await batchAddGames(league, team.espnTeamId, season, [...selected]);
      if (r.ok) setResult(r);
      else setError(r.message);
    });
  }

  function reset() {
    setSchedule(null);
    setSelected(new Set());
    setResult(null);
    setError(null);
  }

  function changeTeam() {
    setSchedule(null);
    setSelected(new Set());
    setError(null);
  }

  // --- success state ---
  if (result) {
    return (
      <div className="rounded-lg border border-border bg-surface px-5 py-10 text-center">
        <Check size={32} className="mx-auto mb-3" style={{ color: "var(--win)" }} />
        <p className="font-medium">{result.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <PlusCircle size={15} /> Add another team
          </Button>
          <ButtonLink href="/games" variant="secondary">
            View game log
          </ButtonLink>
        </div>
      </div>
    );
  }

  // --- schedule + batch-select step ---
  if (schedule) {
    return (
      <div className="pb-24">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={changeTeam}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} /> Change team
          </button>
          <span className="flex items-center gap-2 text-sm font-medium">
            <TeamLogo url={team?.logoUrl ?? null} alt={team?.name ?? ""} size={20} />
            {team?.name} · {season}
          </span>
        </div>

        {error && <p className="mb-3 text-sm" style={{ color: "var(--loss)" }}>{error}</p>}

        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {schedule.map((g) => (
            <ScheduleRow key={g.espnEventId} g={g} checked={selected.has(g.espnEventId)} onToggle={() => toggle(g.espnEventId)} />
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-[var(--z-dropdown)] border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span className="text-sm text-muted">
              <span className="tnum font-medium text-ink">{selected.size}</span> selected
            </span>
            <Button
              variant="primary"
              size="lg"
              className="ml-auto"
              onClick={addSelected}
              disabled={selected.size === 0 || pending}
            >
              <ListChecks size={16} /> {pending ? "Adding…" : `Add ${selected.size} game${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- pick team + season step ---
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">League</span>
        <div className="flex gap-1 rounded-lg border border-border bg-bg p-1">
          {LEAGUES.map((l) => (
            <button
              key={l}
              onClick={() => resetLeague(l)}
              className={`flex-1 rounded px-2 py-1.5 text-sm font-medium transition-colors ${
                league === l ? "bg-primary text-on-primary" : "text-muted hover:text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <TeamPicker label="Team" teams={teams} value={teamId} onChange={setTeamId} />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Season</span>
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="tnum h-11 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
        >
          {seasonOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm" style={{ color: "var(--loss)" }}>{error}</p>}

      <Button variant="primary" size="lg" onClick={viewSchedule} disabled={!canView || pending} className="w-full">
        <ListChecks size={16} /> {pending ? "Loading…" : "View schedule"}
      </Button>
    </div>
  );
}

function ScheduleRow({
  g,
  checked,
  onToggle,
}: {
  g: ScheduleGameItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const disabled = g.alreadyLogged;
  const date = g.dateIso.slice(0, 10);
  // Null OR non-finite (e.g. unplayed games) render as a dash — never NaN.
  const fmtScore = (n: number | null) => (typeof n === "number" && Number.isFinite(n) ? n : "–");

  return (
    <label
      className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
        disabled ? "opacity-60" : "cursor-pointer hover:bg-surface-2"
      }`}
    >
      <input
        type="checkbox"
        checked={disabled ? true : checked}
        disabled={disabled}
        onChange={() => !disabled && onToggle()}
        className="h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="tnum w-[4.5rem] shrink-0 text-xs text-muted">{date}</span>

      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <TeamLogo url={g.awayTeam?.logoUrl ?? null} alt={g.awayTeam?.name ?? "away"} size={22} />
        <span className="truncate text-muted">{g.awayTeam?.abbreviation ?? "—"}</span>
        <span className="tnum text-muted">{fmtScore(g.awayScore)}</span>
        <span className="text-faint">@</span>
        <TeamLogo url={g.homeTeam?.logoUrl ?? null} alt={g.homeTeam?.name ?? "home"} size={22} />
        <span className="truncate text-muted">{g.homeTeam?.abbreviation ?? "—"}</span>
        <span className="tnum text-muted">{fmtScore(g.homeScore)}</span>
      </span>

      <span className="hidden items-center gap-2 text-xs text-muted md:flex">
        {g.isPostseason && <Trophy size={13} style={{ color: "var(--gold)" }} />}
        <span className="max-w-[10rem] truncate">{g.venueName ?? ""}</span>
      </span>

      {g.alreadyLogged ? (
        <span
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
          style={{ background: "var(--win)", color: "var(--on-win)" }}
        >
          <Check size={11} /> Logged
        </span>
      ) : !g.isFinal ? (
        <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ background: "var(--live)", color: "var(--on-live)" }}>
          upcoming
        </span>
      ) : null}
    </label>
  );
}
