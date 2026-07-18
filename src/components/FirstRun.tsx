import { ButtonLink } from "@/components/Button";
import { TeamLogo } from "@/components/TeamLogo";
import type { TeamLite } from "@/lib/stats";

/**
 * The dashboard's zero-state — the last step of onboarding.
 *
 * A brand-new account has nothing to compute, so showing the usual strip of
 * 0–0 records and an empty "Recent games" box teaches nothing. This replaces
 * all of it with the one thing that matters: add a game. It disappears on its
 * own the moment they have one.
 */
export function FirstRun({ teams }: { teams: TeamLite[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface px-6 py-10 text-center">
      <h2 className="text-xl font-semibold tracking-tight">Your almanac is empty</h2>
      <p className="standfirst mx-auto mt-2 max-w-[46ch] text-[15px] leading-snug text-muted">
        Add a game you went to — the score, venue and box score fill themselves in. You just
        add the memory.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/log" variant="primary" size="lg">
          Log your first game
        </ButtonLink>
        <ButtonLink href="/schedule" variant="secondary" size="lg">
          Add a whole season
        </ButtonLink>
      </div>

      <div className="mt-8 border-t border-border pt-5">
        {teams.length > 0 ? (
          <>
            <p className="text-xs text-muted">Tracking your record with</p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
              {teams.map((t) => (
                <TeamLogo key={t.id} url={t.logoUrl} alt={t.name} size={26} ringColor={t.primaryColor} />
              ))}
            </div>
            <ButtonLink href="/choose-teams" variant="ghost" size="sm" className="mt-3">
              Change teams
            </ButtonLink>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">
              Pick your teams and your win/loss record gets tracked automatically.
            </p>
            <ButtonLink href="/choose-teams?onboarding=1" variant="secondary" size="sm" className="mt-3">
              Choose your teams
            </ButtonLink>
          </>
        )}
      </div>
    </section>
  );
}
