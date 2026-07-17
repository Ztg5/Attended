"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Trophy, Timer, StickyNote, Pencil, Trash2, Check, X, BarChart3, Star } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import { Button } from "./Button";
import { updateGame, deleteGame, toggleFavorite } from "@/app/log/actions";
import { stateAbbr } from "@/lib/us-states";
import type { GameLite } from "@/lib/stats";

/** One expandable game row for lists (recent games + the full log). */
export function GameRow({ g, manage = false }: { g: GameLite; manage?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [gone, setGone] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [fav, setFav] = useState(g.favorited);
  const [favMsg, setFavMsg] = useState<string | null>(null);
  const [f, setF] = useState({
    date: g.date,
    homeScore: g.homeScore?.toString() ?? "",
    awayScore: g.awayScore?.toString() ?? "",
    status: g.status,
    notes: g.notes ?? "",
  });
  const [pending, start] = useTransition();

  const decided = g.homeScore != null && g.awayScore != null;
  const homeWin = decided && (g.homeScore as number) > (g.awayScore as number);
  const awayWin = decided && (g.awayScore as number) > (g.homeScore as number);
  const expandable = true; // every game has a box-score detail page
  const otLabel = g.leagueCode === "MLB" ? "XI" : "OT";

  const inputCls = "rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary";

  function toggleFav() {
    setFavMsg(null);
    start(async () => {
      const r = await toggleFavorite(g.id);
      if (r.ok) setFav(r.favorited);
      else setFavMsg(r.message);
    });
  }

  if (gone) return null;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => expandable && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors sm:px-4 ${
          expandable ? "hover:bg-surface-2" : "cursor-default"
        }`}
        aria-expanded={open}
      >
        <span className="tnum w-[4.5rem] shrink-0 text-xs text-muted">{g.date}</span>

        {/* matchup */}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <TeamLogo url={g.away?.logoUrl ?? null} alt={g.away?.name ?? "away"} size={22} />
          <span className={`truncate ${awayWin ? "font-semibold" : "text-muted"}`}>
            {g.away?.abbreviation ?? "—"}
          </span>
          <span className={`tnum ${awayWin ? "font-semibold" : "text-muted"}`}>{g.awayScore ?? "–"}</span>
          <span className="text-faint">@</span>
          <TeamLogo url={g.home?.logoUrl ?? null} alt={g.home?.name ?? "home"} size={22} />
          <span className={`truncate ${homeWin ? "font-semibold" : "text-muted"}`}>
            {g.home?.abbreviation ?? "—"}
          </span>
          <span className={`tnum ${homeWin ? "font-semibold" : "text-muted"}`}>{g.homeScore ?? "–"}</span>
        </span>

        {/* meta */}
        <span className="hidden items-center gap-2 text-xs text-muted md:flex">
          {fav && <Star size={13} fill="var(--gold)" style={{ color: "var(--gold)" }} />}
          {g.isPostseason && <Trophy size={13} style={{ color: "var(--gold)" }} />}
          {g.wentToOvertime && <span className="rounded bg-surface-2 px-1 py-0.5 tnum">{otLabel}</span>}
          {g.notes && <StickyNote size={13} className="text-faint" />}
          <span className="max-w-[10rem] truncate">{g.venueName ?? ""}</span>
        </span>
        {expandable && (
          <ChevronDown
            size={16}
            className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="grid gap-2 bg-surface-2 px-3 py-3 pl-[5.5rem] text-sm sm:px-4 sm:pl-[6rem]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {g.venueName && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} />
                {g.venueName}
                {g.venueCity ? `, ${g.venueCity}${g.venueState ? ", " + stateAbbr(g.venueState) : ""}` : ""}
              </span>
            )}
            {g.attendance != null && (
              <span className="tnum">att {g.attendance.toLocaleString()}</span>
            )}
            {g.isPostseason && (
              <span className="inline-flex items-center gap-1" style={{ color: "var(--gold)" }}>
                <Trophy size={13} />
                {g.postseasonRound ?? "Playoffs"}
              </span>
            )}
            {g.wentToOvertime && (
              <span className="inline-flex items-center gap-1">
                <Timer size={13} />
                {g.leagueCode === "MLB" ? "Extra innings" : "Overtime"}
              </span>
            )}
          </div>
          {g.notes && <p className="note max-w-[68ch] leading-relaxed text-ink">{g.notes}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href={`/games/${g.id}`}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
            >
              <BarChart3 size={13} /> View box score
            </Link>
            <button
              onClick={toggleFav}
              disabled={pending}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              style={{ color: fav ? "var(--gold)" : "var(--muted)" }}
            >
              <Star size={13} fill={fav ? "var(--gold)" : "none"} />
              {fav ? "Favorited" : "Add to favorites"}
            </button>
            {favMsg && <span className="text-xs" style={{ color: "var(--loss)" }}>{favMsg}</span>}
          </div>

          {manage && !editing && (
            <div className="mt-1 flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit
              </Button>
              {confirmDel ? (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className="text-muted">Delete?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => start(async () => { await deleteGame(g.id); setGone(true); })}
                    disabled={pending}
                  >
                    Yes, delete
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setConfirmDel(false)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
                  <Trash2 size={13} /> Delete
                </Button>
              )}
            </div>
          )}

          {manage && editing && (
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted">
                Date
                <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`${inputCls} tnum`} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted">
                Away
                <input inputMode="numeric" value={f.awayScore} onChange={(e) => setF({ ...f, awayScore: e.target.value })} className={`${inputCls} tnum`} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted">
                Home
                <input inputMode="numeric" value={f.homeScore} onChange={(e) => setF({ ...f, homeScore: e.target.value })} className={`${inputCls} tnum`} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted">
                Status
                <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}>
                  <option value="final">final</option>
                  <option value="pending">pending</option>
                  <option value="needs_review">needs_review</option>
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted sm:col-span-4">
                Note
                <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className={`${inputCls} note`} />
              </label>
              <div className="col-span-2 flex gap-2 sm:col-span-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => start(async () => { await updateGame(g.id, f); setEditing(false); })}
                  disabled={pending}
                >
                  <Check size={13} /> {pending ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  <X size={13} /> Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
