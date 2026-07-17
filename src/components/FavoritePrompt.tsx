"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";

const DISMISS_KEY = "attended_fav_prompt_dismissed";

/** Nudge users to pick favorite games (they weren't discovering it). Dismissable. */
export function FavoritePrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-border px-4 py-3" style={{ background: "var(--primary-weak)" }}>
      <Star size={18} className="shrink-0" style={{ color: "var(--gold)" }} />
      <p className="text-sm">
        Pick your <span className="font-semibold">4 favorite games</span> — open any game and tap the
        star. They show on your profile.{" "}
        <Link href="/games" className="font-medium text-primary hover:text-primary-hover">
          Go to your game log →
        </Link>
      </p>
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
          setShow(false);
        }}
        aria-label="Dismiss"
        className="ml-auto shrink-0 text-faint transition-colors hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  );
}
