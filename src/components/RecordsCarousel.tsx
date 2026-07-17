"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GameLine } from "./GameLine";
import type { GameLite, LeagueRecords } from "@/lib/stats";

interface Card {
  label: string;
  game: GameLite | null;
  detail: (g: GameLite) => string;
}
interface Page {
  title: string;
  cards: Card[];
}

const margin = (g: GameLite) => Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0));
const total = (g: GameLite) => (g.homeScore ?? 0) + (g.awayScore ?? 0);

export function RecordsCarousel({
  firstByLeague,
  perLeague,
}: {
  firstByLeague: { code: string; game: GameLite }[];
  perLeague: LeagueRecords[];
}) {
  const pages: Page[] = [
    {
      title: "First games",
      cards: firstByLeague.map((f) => ({
        label: `First ${f.code}`,
        game: f.game,
        detail: (g: GameLite) => g.date,
      })),
    },
    ...perLeague.map((l): Page => ({
      title: `${l.code} records`,
      cards: [
        { label: "Highest scoring", game: l.highestScoring, detail: (g: GameLite) => `${total(g)} combined` },
        { label: "Lowest scoring", game: l.lowestScoring, detail: (g: GameLite) => `${total(g)} combined` },
        { label: "Biggest blowout", game: l.biggestBlowout, detail: (g: GameLite) => `${margin(g)}-pt margin` },
        { label: "Biggest crowd", game: l.biggestCrowd, detail: (g: GameLite) => `${(g.attendance ?? 0).toLocaleString()} fans` },
      ],
    })),
  ].filter((p) => p.cards.some((c) => c.game));

  const [i, setI] = useState(0);
  if (pages.length === 0) return null;
  const page = pages[Math.min(i, pages.length - 1)];
  const go = (d: number) => setI((prev) => (prev + d + pages.length) % pages.length);

  return (
    <div>
      <div className="section-head mb-3">
        <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-ink">{page.title}</h2>
        <span className="rule" />
        {pages.length > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => go(-1)} aria-label="Previous" className="rounded-md border border-border bg-surface p-1 text-muted transition-colors hover:text-ink">
              <ChevronLeft size={16} />
            </button>
            <span className="tnum px-1 text-xs text-faint">{(i % pages.length) + 1}/{pages.length}</span>
            <button onClick={() => go(1)} aria-label="Next" className="rounded-md border border-border bg-surface p-1 text-muted transition-colors hover:text-ink">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {page.cards.map((c, idx) => (
          <RecordCard key={idx} card={c} />
        ))}
      </div>
    </div>
  );
}

function RecordCard({ card }: { card: Card }) {
  const inner = (
    <>
      <div className="mb-2 text-xs font-medium text-muted">{card.label}</div>
      {card.game ? (
        <>
          <GameLine g={card.game} size={22} />
          <div className="tnum mt-1.5 text-xs text-faint">{card.detail(card.game)}</div>
        </>
      ) : (
        <div className="text-sm text-faint">—</div>
      )}
    </>
  );
  const cls = "block rounded-lg border border-border bg-surface px-4 py-3";
  return card.game ? (
    <Link href={`/games/${card.game.id}`} className={`${cls} transition-colors hover:bg-surface-2`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
