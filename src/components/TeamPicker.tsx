"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { TeamLogo } from "./TeamLogo";

export interface TeamOpt {
  id: number;
  name: string;
  nickname: string;
  abbreviation: string;
  logoUrl: string | null;
}

/** Searchable team combobox with logos. Mobile-friendly: big targets, in-flow dropdown. */
export function TeamPicker({
  label,
  teams,
  value,
  onChange,
  exclude,
}: {
  label: string;
  teams: TeamOpt[];
  value: number | null;
  onChange: (id: number | null) => void;
  exclude?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = teams.find((t) => t.id === value) ?? null;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return teams
      .filter((t) => t.id !== exclude)
      .filter((t) =>
        !query
          ? true
          : [t.name, t.nickname, t.abbreviation].some((s) => s.toLowerCase().includes(query))
      );
  }, [teams, q, exclude]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-bg px-3 text-left text-sm outline-none focus:border-primary"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {selected ? (
            <>
              <TeamLogo url={selected.logoUrl} alt={selected.name} size={22} />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-faint">Select team…</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {selected && (
              <X
                size={15}
                className="text-faint hover:text-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronDown size={16} className="text-faint" />
          </span>
        </button>

        {open && (
          <div
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] max-h-72 overflow-auto rounded-lg border border-border bg-surface shadow-lg"
            role="listbox"
          >
            <div className="sticky top-0 border-b border-border bg-surface p-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-9 w-full rounded border border-border bg-bg px-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            {filtered.length ? (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                    t.id === value ? "bg-primary-weak" : ""
                  }`}
                  role="option"
                  aria-selected={t.id === value}
                >
                  <TeamLogo url={t.logoUrl} alt={t.name} size={22} />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto text-xs text-faint">{t.abbreviation}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted">No teams match.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
