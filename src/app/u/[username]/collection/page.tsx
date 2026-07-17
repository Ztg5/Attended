import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { friendStatus } from "@/lib/social";
import { getChecklist } from "@/lib/collection";
import { TeamLogo } from "@/components/TeamLogo";
import { BackLink } from "@/components/BackLink";
import { PageMasthead } from "@/components/PageMasthead";

export const dynamic = "force-dynamic";

export default async function FriendCollectionPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewerId = await requireUserId();

  const target = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true, username: true, name: true },
  });
  if (!target) notFound();

  // Only friends (or the user themselves) can see someone's collection.
  const status = await friendStatus(viewerId, target.id);
  if (status !== "self" && status !== "friends") notFound();

  const checklist = await getChecklist(target.id);
  const display = target.username ? `@${target.username}` : target.name ?? "User";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-1">
        <BackLink fallback={`/u/${target.username}`} />
      </div>

      <PageMasthead title={`${display}'s collection`} className="mb-6 mt-4" />

      <section className="flex flex-col gap-7">
        {checklist.map((l) => {
          const pct = l.total ? Math.round((l.seen / l.total) * 100) : 0;
          return (
            <div key={l.code}>
              <div className="mb-2 flex items-baseline gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide">{l.code}</h2>
                <span className="tnum text-sm text-muted">
                  {l.seen}/{l.total} seen
                </span>
                <div className="ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-2 rounded-lg border border-border bg-surface p-3">
                {l.teams.map((t) => (
                  <div key={t.id} className="flex flex-col items-center gap-1" title={`${t.name}${t.seen ? "" : " — not yet seen"}`}>
                    <TeamLogo url={t.logoUrl} alt={t.name} size={34} dimmed={!t.seen} />
                    <span className={`text-[10px] ${t.seen ? "text-muted" : "text-faint"}`}>{t.abbreviation}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
