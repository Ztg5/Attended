import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShareView } from "@/lib/share";
import { TeamLogo } from "@/components/TeamLogo";
import { GameLine } from "@/components/GameLine";
import { ZubazBanner } from "@/components/ZubazBanner";
import { ButtonLink } from "@/components/Button";
import { stateAbbr } from "@/lib/us-states";

// No `force-dynamic`: the [token] segment is already server-rendered on demand,
// and forcing it made Next stream the shell before notFound() could set a 404.
export const revalidate = 0;

/**
 * The public share view — the ONLY unauthenticated data surface in the app.
 *
 * Reached only with an unguessable token the owner generated and sent. Renders
 * dashboard highlights read-only: nothing here links into the authenticated app
 * (those routes would just bounce a visitor to /sign-in), and private notes are
 * never fetched (see lib/share.ts + getPublicDashboard).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const view = await getShareView((await params).token);
  // Resolve unknown tokens here, before the response commits — otherwise the
  // shell streams with a 200 and notFound() in the page can't change the status.
  if (!view) notFound();
  const who = view.user.name ?? (view.user.username ? `@${view.user.username}` : "A fan");
  return {
    title: `${who} on Attended`,
    description: `Every professional sporting event ${who} has attended.`,
    // A share link is meant for the people it was sent to — keep it out of search.
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getShareView(token);
  // Unknown or revoked tokens 404 — identical response either way, so a probe
  // can't learn whether a token ever existed.
  if (!view) notFound();

  const { user, dashboard: d, collection, bannerTeam } = view;
  const display = user.name ?? (user.username ? `@${user.username}` : "A fan");
  const rec = (w: number, l: number, t: number) => (t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`);
  const pct = (w: number, l: number) => (w + l ? Math.round((w / (w + l)) * 100) : 0);

  return (
    <>
      {/* Product bar — this visitor has no account, so identify the app and
          keep the way in permanently visible. */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5 sm:px-6">
          <span className="nameplate text-lg">Attended</span>
          <ButtonLink href="/sign-in" variant="primary" size="sm">
            Start your own log
          </ButtonLink>
        </div>
      </div>

      {bannerTeam && (
        <ZubazBanner
          primary={bannerTeam.primaryColor}
          secondary={bannerTeam.secondaryColor}
          height={36}
        />
      )}

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="nameplate text-[2.25rem] leading-none sm:text-[2.5rem]">{display}</h1>
          <p className="standfirst mt-2 text-[15px] leading-snug text-muted">
            Every professional sporting event {user.name?.split(" ")[0] ?? "they"}&apos;ve attended.
          </p>
          <hr className="rule-ledger mt-5" />
        </header>

        {d.totalGames === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
            No games logged yet.
          </p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Record attending" value={rec(d.overall.wins, d.overall.losses, d.overall.ties)} sub={`${pct(d.overall.wins, d.overall.losses)}% W`} anchor />
              <Stat label="Games" value={d.totalGames} />
              <Stat label="Venues" value={d.venuesVisited} />
              <Stat label="Playoff games" value={d.playoffCount} />
              <Stat label="Win streak" value={d.currentWinStreak} sub="current" />
              <Stat label="Longest streak" value={d.longestWinStreak} sub="wins in a row" />
            </section>
            <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 text-xs text-muted">
              {d.perLeague.map((l) => (
                <span key={l.code}>
                  <span className="font-medium text-ink">{l.code}</span>{" "}
                  <span className="tnum">{l.count}</span>
                </span>
              ))}
            </p>

            {d.followed.length > 0 && (
              <Section title="By team">
                <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                  {d.followed.map((f) => (
                    <div key={f.team.id} className="flex items-center gap-3 px-4 py-3">
                      <TeamLogo url={f.team.logoUrl} alt={f.team.name} size={30} ringColor={f.team.primaryColor} />
                      <span className="font-medium">{f.team.name}</span>
                      <span className="ml-auto flex items-baseline gap-3">
                        <span className="tnum text-lg font-semibold">{rec(f.wins, f.losses, f.ties)}</span>
                        <span className="tnum w-12 text-right text-sm text-muted">{pct(f.wins, f.losses)}%</span>
                        <span className="tnum w-16 text-right text-xs text-faint">{f.games} games</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {collection.length > 0 && (
              <Section title="Collection">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                  {collection.map((c) => (
                    <div key={c.code} className="bg-bg px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{c.code}</div>
                      <div className="tnum mt-1 text-lg font-semibold leading-none">
                        {c.seen}
                        <span className="text-sm font-normal text-faint">/{c.total}</span>
                      </div>
                      <div className="text-[11px] text-faint">teams seen</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {d.recentGames.length > 0 && (
              <Section title="Recent games">
                <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                  {d.recentGames.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                      <span className="tnum w-[4.5rem] shrink-0 text-xs text-muted">{g.date}</span>
                      <GameLine g={g} size={22} />
                      <span className="ml-auto hidden max-w-[12rem] truncate text-xs text-muted md:block">
                        {g.venueName}
                        {g.venueCity ? `, ${g.venueCity}${g.venueState ? ", " + stateAbbr(g.venueState) : ""}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* The ask. */}
        <section className="mt-12 rounded-lg border border-border bg-surface px-6 py-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Keep your own almanac</h2>
          <p className="standfirst mx-auto mt-2 max-w-[46ch] text-[15px] leading-snug text-muted">
            Log every game you go to. Scores, venues and box scores fill themselves in — you
            just add the memory.
          </p>
          <div className="mt-5">
            <ButtonLink href="/sign-in" variant="primary" size="lg">
              Start your own log
            </ButtonLink>
          </div>
          <p className="mt-3 text-xs text-faint">Free, and it takes about a minute.</p>
        </section>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  anchor = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  anchor?: boolean;
}) {
  return (
    <div className="bg-bg px-4 py-3.5">
      <span className={`tnum block font-semibold leading-none ${anchor ? "text-[1.875rem]" : "text-2xl"}`}>
        {value}
      </span>
      <div className={`mt-1.5 text-xs font-medium ${anchor ? "text-ink" : "text-muted"}`}>{label}</div>
      {sub && <div className="tnum text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="section-head mb-3">
        <h2 className="shrink-0 text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        <span className="rule" />
      </div>
      {children}
    </section>
  );
}
