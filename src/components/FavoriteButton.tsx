"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavorite } from "@/app/log/actions";

/** Star toggle for a game the user attended. Enforces the 4-favorite cap server-side. */
export function FavoriteButton({ gameId, initial }: { gameId: number; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    setMsg(null);
    start(async () => {
      const r = await toggleFavorite(gameId);
      if (r.ok) setFav(r.favorited);
      else setMsg(r.message);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={pending}
        title={fav ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={fav}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        <Star size={15} fill={fav ? "var(--gold)" : "none"} style={{ color: fav ? "var(--gold)" : "var(--muted)" }} />
        <span className={fav ? "" : "text-muted"}>{fav ? "Favorite" : "Favorite"}</span>
      </button>
      {msg && <span className="text-xs" style={{ color: "var(--loss)" }}>{msg}</span>}
    </span>
  );
}
