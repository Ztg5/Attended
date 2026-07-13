"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";
import type { PlayerListItem } from "@/lib/players";

type Sort = "seen" | "name";
const LEAGUE_ORDER = ["NFL", "MLB", "NBA", "NHL"];

export function PlayersGrid({ players }: { players: PlayerListItem[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("seen");
  const [league, setLeague] = useState<string>("ALL");
  const [position, setPosition] = useState<string>("ALL");

  const leagues = useMemo(
    () => LEAGUE_ORDER.filter((code) => players.some((p) => p.leagueCode === code)),
    [players]
  );

  // Positions available within the selected league (blank until a league is chosen).
  const positions = useMemo(() => {
    if (league === "ALL") return [];
    const set = new Set<string>();
    for (const p of players) if (p.leagueCode === league && p.position) set.add(p.position);
    return [...set].sort();
  }, [players, league]);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = players.filter((p) => {
      if (query && !p.name.toLowerCase().includes(query)) return false;
      if (league !== "ALL" && p.leagueCode !== league) return false;
      if (position !== "ALL" && p.position !== position) return false;
      return true;
    });
    return [...list].sort((a, b) =>
      sort === "seen" ? b.timesSeen - a.timesSeen || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
    );
  }, [players, q, sort, league, position]);

  function pickLeague(code: string) {
    setLeague(code);
    setPosition("ALL"); // reset position when the league changes
  }

  const tab = (active: boolean) =>
    `rounded px-2.5 py-1 text-sm font-medium transition-colors ${
      active ? "bg-primary text-on-primary" : "text-muted hover:bg-surface-2 hover:text-ink"
    }`;
  const controlCls =
    "rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-primary";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        {/* League + position */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button className={tab(league === "ALL")} onClick={() => pickLeague("ALL")}>
              All
            </button>
            {leagues.map((code) => (
              <button key={code} className={tab(league === code)} onClick={() => pickLeague(code)}>
                {code}
              </button>
            ))}
          </div>
          {league !== "ALL" && positions.length > 0 && (
            <select value={position} onChange={(e) => setPosition(e.target.value)} className={controlCls}>
              <option value="ALL">All positions</option>
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search + sort */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative sm:w-64">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players…"
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 sm:ml-auto">
            <span className="px-1.5 text-xs text-faint">Sort</span>
            <button className={tab(sort === "seen")} onClick={() => setSort("seen")}>
              Times seen
            </button>
            <button className={tab(sort === "name")} onClick={() => setSort("name")}>
              Name
            </button>
          </div>
        </div>
      </div>

      <div className="mb-2 text-xs text-muted">
        <span className="tnum">{shown.length}</span> player{shown.length === 1 ? "" : "s"}
      </div>

      {shown.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {shown.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2"
            >
              <PlayerHeadshot url={p.headshotUrl} name={p.name} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">
                  {p.position ? `${p.position} · ` : ""}
                  <span className="tnum">{p.timesSeen}</span> seen
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          No players match.
        </div>
      )}
    </div>
  );
}
