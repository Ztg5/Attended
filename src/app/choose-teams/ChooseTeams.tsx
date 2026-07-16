"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { TeamLogo } from "@/components/TeamLogo";
import { Button } from "@/components/Button";
import { setFavoriteTeams } from "./actions";

export interface TeamOpt {
  id: number;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
}
export interface LeagueTeams {
  code: string;
  teams: TeamOpt[];
}

export function ChooseTeams({
  leagues,
  initialSelected,
  onboarding,
}: {
  leagues: LeagueTeams[];
  initialSelected: number[];
  onboarding: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected));
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    start(async () => {
      await setFavoriteTeams([...selected]);
      router.push("/");
    });

  return (
    <div className="flex flex-col gap-6">
      {leagues.map((l) => (
        <div key={l.code}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{l.code}</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-2 rounded-lg border border-border bg-surface p-3">
            {l.teams.map((t) => {
              const on = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-pressed={on}
                  title={t.name}
                  className={`relative flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
                    on ? "bg-primary-weak ring-1 ring-primary" : "hover:bg-surface-2"
                  }`}
                >
                  {on && (
                    <span className="absolute right-0.5 top-0.5 rounded-full bg-primary p-0.5 text-on-primary">
                      <Check size={10} />
                    </span>
                  )}
                  <TeamLogo url={t.logoUrl} alt={t.name} size={34} dimmed={!on} />
                  <span className={`text-[10px] ${on ? "font-medium text-ink" : "text-faint"}`}>{t.abbreviation}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-bg py-3">
        <span className="text-sm text-muted">
          <span className="tnum font-medium text-ink">{selected.size}</span> selected
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/")}>
            {onboarding ? "Skip for now" : "Cancel"}
          </Button>
          <Button variant="primary" onClick={save} disabled={pending}>
            <Check size={15} /> {pending ? "Saving…" : "Save teams"}
          </Button>
        </div>
      </div>
    </div>
  );
}
