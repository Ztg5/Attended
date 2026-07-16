"use client";

import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { GameRow } from "@/components/GameRow";
import { Button } from "@/components/Button";
import type { GameLite } from "@/lib/stats";

type SortKey = "date-desc" | "date-asc";

/** RFC-4180 CSV cell: quote when it contains a comma, quote, or newline. */
function csvCell(value: string | number | null): string {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function GameLog({ games, leagues }: { games: GameLite[]; leagues: string[] }) {
  const [league, setLeague] = useState<string>("ALL");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [q, setQ] = useState("");

  /** Download every attended game (date, home + score, away + score) as a CSV Excel opens. */
  function exportCsv() {
    const header = ["Date", "Home Team", "Home Score", "Away Team", "Away Score"];
    const rows = [...games]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((g) => [g.date, g.home?.name ?? "", g.homeScore ?? "", g.away?.name ?? "", g.awayScore ?? ""]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

    // Prepend a UTF-8 BOM so Excel reads accented team names correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attended-games.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = games.filter((g) => {
      if (league !== "ALL" && g.leagueCode !== league) return false;
      if (!query) return true;
      return [
        g.home?.name,
        g.home?.nickname,
        g.away?.name,
        g.away?.nickname,
        g.venueName,
        g.notes,
        g.date,
      ]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(query));
    });
    list = [...list].sort((a, b) =>
      sort === "date-desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
    return list;
  }, [games, league, sort, q]);

  const tabCls = (active: boolean) =>
    `rounded px-2.5 py-1 text-sm font-medium transition-colors ${
      active ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <button className={tabCls(league === "ALL")} onClick={() => setLeague("ALL")}>
            All
          </button>
          {leagues.map((l) => (
            <button key={l} className={tabCls(league === l)} onClick={() => setLeague(l)}>
              {l}
            </button>
          ))}
        </div>

        <label className="relative sm:ml-auto sm:w-56">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team, venue, note…"
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
          />
        </label>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
        </select>

        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={games.length === 0} title="Download all your games as a spreadsheet">
          <Download size={15} /> Export
        </Button>
      </div>

      <div className="mb-2 text-xs text-muted">
        <span className="tnum">{filtered.length}</span> game{filtered.length === 1 ? "" : "s"}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {filtered.length ? (
          filtered.map((g) => <GameRow key={g.id} g={g} manage />)
        ) : (
          <div className="px-4 py-10 text-center text-sm text-muted">No games match.</div>
        )}
      </div>
    </div>
  );
}
