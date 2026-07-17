"use client";

import { useState, useTransition } from "react";
import { Search, Check, ArrowLeft, Trophy, Timer, AlertTriangle, PlusCircle } from "lucide-react";
import { TeamPicker, type TeamOpt } from "@/components/TeamPicker";
import { TeamLogo } from "@/components/TeamLogo";
import { Button, ButtonLink } from "@/components/Button";
import { previewMatch, saveLoggedGame, type PreviewResult } from "./actions";

const LEAGUES = ["NFL", "MLB", "NBA", "NHL"] as const;
const today = () => new Date().toISOString().slice(0, 10);

export function LogForm({ teamsByLeague }: { teamsByLeague: Record<string, TeamOpt[]> }) {
  const [league, setLeague] = useState<string>("NFL");
  const [homeId, setHomeId] = useState<number | null>(null);
  const [date, setDate] = useState(today());

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [note, setNote] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const teams = teamsByLeague[league] ?? [];
  const canFind = homeId && date;

  function resetLeague(l: string) {
    setLeague(l);
    setHomeId(null);
    setPreview(null);
    setError(null);
  }

  function find() {
    setError(null);
    start(async () => {
      const r = await previewMatch(league, homeId!, date);
      setPreview(r);
    });
  }

  function save(asReview: boolean) {
    setError(null);
    start(async () => {
      const r = await saveLoggedGame(league, homeId!, date, note, asReview);
      if (r.ok) setSavedId(r.gameId ?? null);
      else setError(r.message);
    });
  }

  function reset() {
    setPreview(null);
    setNote("");
    setSavedId(null);
    setError(null);
    setHomeId(null);
    setDate(today());
  }

  // --- success state ---
  if (savedId) {
    return (
      <div className="rounded-lg border border-border bg-surface px-5 py-10 text-center">
        <Check size={32} className="mx-auto mb-3" style={{ color: "var(--win)" }} />
        <p className="font-medium">Game logged.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <PlusCircle size={15} /> Log another
          </Button>
          <ButtonLink href="/games" variant="secondary">
            View game log
          </ButtonLink>
        </div>
      </div>
    );
  }

  // --- confirm step ---
  if (preview) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        {preview.verdict === "matched" && preview.match ? (
          <>
            <div className="border-b border-border px-5 py-5 text-center">
              <p className="mb-3 text-sm text-muted">Is this the game?</p>
              <div className="flex items-center justify-center gap-3">
                <Side team={preview.match.awayTeam} score={preview.match.awayScore} />
                <span className="text-faint">@</span>
                <Side team={preview.match.homeTeam} score={preview.match.homeScore} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="tnum">{preview.match.date}</span>
                {preview.match.venueName && <span>{preview.match.venueName}</span>}
                {preview.match.isPostseason && (
                  <span className="inline-flex items-center gap-1" style={{ color: "var(--gold)" }}>
                    <Trophy size={12} /> {preview.match.postseasonRound ?? "Playoffs"}
                  </span>
                )}
                {preview.match.wentToOvertime && (
                  <span className="inline-flex items-center gap-1">
                    <Timer size={12} /> {league === "MLB" ? "Extra innings" : "OT"}
                  </span>
                )}
                {preview.match.gameStatus === "pending" && (
                  <span className="rounded px-1.5 py-0.5 font-medium" style={{ background: "var(--live)", color: "var(--on-live)" }}>
                    in progress
                  </span>
                )}
              </div>
            </div>

            {preview.duplicateGameId ? (
              <div className="flex items-center gap-2 px-5 py-4 text-sm" style={{ color: "var(--loss)" }}>
                <AlertTriangle size={16} /> You&apos;ve already logged this game.
              </div>
            ) : (
              <div className="px-5 py-4">
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Note (the memory)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Who you went with, what happened, how it felt…"
                  className="note w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                />
              </div>
            )}
          </>
        ) : (
          <div className="px-5 py-6">
            <div className="mb-2 flex items-center gap-2 font-medium" style={{ color: "var(--review)" }}>
              <AlertTriangle size={18} /> Couldn&apos;t confirm this game on ESPN
            </div>
            <ul className="mb-4 list-inside list-disc text-sm text-muted">
              {preview.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <label className="mb-1.5 block text-xs font-medium text-muted">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="note w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        {error && <p className="px-5 text-sm" style={{ color: "var(--loss)" }}>{error}</p>}

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <Button variant="secondary" onClick={() => setPreview(null)} disabled={pending}>
            <ArrowLeft size={15} /> Back
          </Button>
          {preview.verdict === "matched" && !preview.duplicateGameId ? (
            <Button variant="primary" className="ml-auto" onClick={() => save(false)} disabled={pending}>
              <Check size={15} /> {pending ? "Saving…" : "Save game"}
            </Button>
          ) : preview.verdict === "no_match" ? (
            <Button variant="secondary" className="ml-auto" onClick={() => save(true)} disabled={pending}>
              Save anyway for review
            </Button>
          ) : (
            <ButtonLink href="/games" variant="secondary" className="ml-auto">
              View existing
            </ButtonLink>
          )}
        </div>
      </div>
    );
  }

  // --- details step ---
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">League</span>
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

      <TeamPicker label="Home team" teams={teams} value={homeId} onChange={setHomeId} />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Date</span>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="tnum h-11 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {error && <p className="text-sm" style={{ color: "var(--loss)" }}>{error}</p>}

      <Button variant="primary" size="lg" onClick={find} disabled={!canFind || pending} className="w-full">
        <Search size={16} /> {pending ? "Finding…" : "Find game"}
      </Button>
    </div>
  );
}

function Side({ team, score }: { team: { name: string; abbreviation: string; logoUrl: string | null } | null; score: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <TeamLogo url={team?.logoUrl ?? null} alt={team?.name ?? "team"} size={36} />
      <span className="font-medium">{team?.abbreviation ?? "—"}</span>
      <span className="tnum text-2xl font-semibold">{score ?? "–"}</span>
    </div>
  );
}
