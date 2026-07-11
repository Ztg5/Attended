import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getChecklist, getVenues, type LeagueChecklist, type VenueVisit } from "@/lib/collection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TeamLogo } from "@/components/TeamLogo";
import { StadiumMap } from "@/components/StadiumMap";
import { stateAbbr } from "@/lib/us-states";

export const revalidate = 60;

export default async function CollectionPage() {
  const [checklist, venues] = await Promise.all([getChecklist(), getVenues()]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowLeft size={15} /> Attended
        </Link>
        <ThemeToggle />
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
        <p className="mt-1 text-sm text-muted">
          Every team you&apos;ve watched, and every stadium you&apos;ve set foot in.
        </p>
      </header>

      {/* Team checklists */}
      <section className="flex flex-col gap-7">
        {checklist.map((l) => (
          <ChecklistBlock key={l.code} league={l} />
        ))}
      </section>

      {/* Stadiums */}
      <section className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Stadiums</h2>
          <span className="tnum text-sm text-muted">
            {venues.length} visited
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface p-3 sm:p-5">
          <StadiumMap venues={venues} />
          <p className="mt-1 text-center text-xs text-muted">
            Pin size = games attended · hover a pin for details
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
          {venues.map((v) => (
            <VenueRow key={v.id} v={v} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ChecklistBlock({ league }: { league: LeagueChecklist }) {
  const pct = league.total ? Math.round((league.seen / league.total) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{league.code}</h2>
        <span className="tnum text-sm text-muted">
          {league.seen}/{league.total} seen
        </span>
        <div className="ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-2 rounded-lg border border-border bg-surface p-3">
        {league.teams.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-1" title={`${t.name}${t.seen ? "" : " — not yet seen"}`}>
            <TeamLogo url={t.logoUrl} alt={t.name} size={34} dimmed={!t.seen} />
            <span className={`text-[10px] ${t.seen ? "text-muted" : "text-faint"}`}>{t.abbreviation}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueRow({ v }: { v: VenueVisit }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <TeamLogo url={v.teamLogo} alt={v.teamName ?? v.name} size={26} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{v.name}</span>
          <span className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted ring-1 ring-border">
            {v.leagueCode}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          <MapPin size={11} />
          {[v.city, stateAbbr(v.state)].filter(Boolean).join(", ")}
        </div>
      </div>
      <div className="ml-auto flex items-baseline gap-4 text-right">
        <div>
          <div className="tnum text-lg font-semibold leading-none">{v.games}</div>
          <div className="text-[10px] uppercase tracking-wide text-faint">games</div>
        </div>
        <div className="hidden sm:block">
          <div className="tnum text-xs text-muted">
            {v.firstVisit === v.lastVisit ? v.firstVisit : `${v.firstVisit} → ${v.lastVisit}`}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-faint">
            {v.firstVisit === v.lastVisit ? "visit" : "first → last"}
          </div>
        </div>
      </div>
    </div>
  );
}
