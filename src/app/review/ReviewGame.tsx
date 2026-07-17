"use client";

import { useMemo, useState, useTransition } from "react";
import { Flag, RefreshCw, Check, Save } from "lucide-react";
import { TeamLogo } from "@/components/TeamLogo";
import { Button } from "@/components/Button";
import { rerunMatch, saveGame, markReviewed, type ActionResult } from "./actions";

export interface TeamOpt {
  id: number;
  name: string;
  nickname: string;
  logoUrl: string | null;
}

export interface GameVM {
  id: number;
  leagueCode: string;
  date: string;
  seasonYear: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  notes: string;
  matchNote: string | null;
  claimedResult: string | null;
  venueName: string | null;
  isPostseason: boolean;
  postseasonRound: string | null;
  attendance: number | null;
}

const inputCls =
  "rounded border border-border bg-bg px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary";
const labelCls = "text-xs font-medium text-muted";

export function ReviewGame({ game, teams }: { game: GameVM; teams: TeamOpt[] }) {
  const [date, setDate] = useState(game.date);
  const [homeTeamId, setHomeTeamId] = useState(String(game.homeTeamId ?? ""));
  const [awayTeamId, setAwayTeamId] = useState(String(game.awayTeamId ?? ""));
  const [homeScore, setHomeScore] = useState(game.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(game.awayScore?.toString() ?? "");
  const [status, setStatus] = useState(game.status);
  const [notes, setNotes] = useState(game.notes);
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(teams.map((t) => [String(t.id), t])), [teams]);
  const home = byId.get(homeTeamId);
  const away = byId.get(awayTeamId);

  function run(fn: () => Promise<ActionResult>) {
    start(async () => setMsg(await fn()));
  }

  return (
    <article className="rounded-lg border border-border bg-surface">
      {/* Matchup header — real logos, mono score */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <TeamLogo url={away?.logoUrl ?? null} alt={away?.name ?? "away"} size={32} />
          <span className="font-medium">{away?.nickname ?? "—"}</span>
          <span className="tnum text-lg font-semibold">{awayScore || "–"}</span>
        </div>
        <span className="text-faint">@</span>
        <div className="flex items-center gap-2.5">
          <TeamLogo url={home?.logoUrl ?? null} alt={home?.name ?? "home"} size={32} />
          <span className="font-medium">{home?.nickname ?? "—"}</span>
          <span className="tnum text-lg font-semibold">{homeScore || "–"}</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span className="tnum">{date}</span>
          <span className="rounded bg-bg px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted ring-1 ring-border">
            {game.leagueCode}
          </span>
          {game.isPostseason && (
            <span className="rounded bg-primary-weak px-1.5 py-0.5 text-xs font-medium text-primary">
              {game.postseasonRound ?? "Playoffs"}
            </span>
          )}
        </div>
      </header>

      {/* Why it's flagged */}
      {game.matchNote && (
        <div className="flex items-start gap-2 border-b border-border px-4 py-2.5 text-sm text-muted sm:px-5">
          <Flag size={15} className="mt-0.5 shrink-0" style={{ color: "var(--review)" }} />
          <span>{game.matchNote}</span>
        </div>
      )}

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 px-4 py-4 sm:grid-cols-4 sm:px-5">
        <Field label="Away team" className="col-span-2 sm:col-span-1">
          <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className={inputCls}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Home team" className="col-span-2 sm:col-span-1">
          <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className={inputCls}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} tnum`} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="final">final</option>
            <option value="pending">pending</option>
            <option value="needs_review">needs_review</option>
          </select>
        </Field>
        <Field label="Away score">
          <input inputMode="numeric" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className={`${inputCls} tnum`} />
        </Field>
        <Field label="Home score">
          <input inputMode="numeric" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className={`${inputCls} tnum`} />
        </Field>
        {game.claimedResult && (
          <Field label="CSV claimed" className="col-span-2">
            <span className="tnum py-1.5 text-sm text-muted">{game.claimedResult}</span>
          </Field>
        )}
        <Field label="Note (the memory)" className="col-span-2 sm:col-span-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${inputCls} note w-full resize-y leading-relaxed`}
          />
        </Field>
      </div>

      {/* Actions */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
        <Button variant="secondary" onClick={() => run(() => rerunMatch(game.id))} disabled={pending}>
          <RefreshCw size={15} className={pending ? "animate-spin" : ""} /> Re-run match
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            run(() => saveGame(game.id, { date, homeTeamId, awayTeamId, homeScore, awayScore, status, notes }))
          }
          disabled={pending}
        >
          <Save size={15} /> Save changes
        </Button>
        <Button variant="primary" onClick={() => run(() => markReviewed(game.id))} disabled={pending}>
          <Check size={15} /> Mark reviewed
        </Button>
        {msg && (
          <span
            className="ml-auto text-sm"
            style={{ color: msg.ok ? "var(--win)" : "var(--loss)" }}
            role="status"
          >
            {msg.message}
          </span>
        )}
      </footer>
    </article>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}
