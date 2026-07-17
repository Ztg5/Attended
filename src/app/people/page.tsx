import Link from "next/link";
import { Search, Users, Inbox } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { requireUserId } from "@/lib/session";
import { getIncomingRequests, getOutgoingRequests, getFriends, searchUsers, type UserLite } from "@/lib/social";
import { FriendButton, type FriendStatus } from "@/components/FriendButton";

export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const userId = await requireUserId();
  const q = (await searchParams).q?.trim() ?? "";

  const [incoming, outgoing, friends, results] = await Promise.all([
    getIncomingRequests(userId),
    getOutgoingRequests(userId),
    getFriends(userId),
    q ? searchUsers(q, userId) : Promise.resolve([]),
  ]);
  const outgoingIds = new Set(outgoing.map((u) => u.id));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-1 flex items-center justify-between">
        <BackLink />
      </div>

      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <Users size={24} className="text-primary" /> People
        </h1>
        <p className="mt-1 text-sm text-muted">Find friends by username and compare the games you&apos;ve seen.</p>
      </header>

      {/* Search (GET form) */}
      <form method="get" className="mb-6">
        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search username or name…"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </form>

      {q && (
        <Section title={`Results for “${q}”`}>
          {results.length ? (
            results.map((u) => <UserRow key={u.id} user={u} status={u.status} />)
          ) : (
            <Empty>No users match.</Empty>
          )}
        </Section>
      )}

      {incoming.length > 0 && (
        <Section title="Friend requests" icon={<Inbox size={15} />}>
          {incoming.map((u) => <UserRow key={u.id} user={u} status="incoming" />)}
        </Section>
      )}

      <Section title={`Friends (${friends.length})`}>
        {friends.length ? (
          friends.map((u) => <UserRow key={u.id} user={u} status="friends" />)
        ) : (
          <Empty>No friends yet — search above to add some.</Empty>
        )}
      </Section>

      {outgoing.length > 0 && (
        <Section title="Sent requests">
          {outgoing.map((u) => <UserRow key={u.id} user={u} status="outgoing" />)}
        </Section>
      )}
    </main>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

function UserRow({ user, status }: { user: UserLite; status: FriendStatus }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-muted">
        {(user.username ?? user.name ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        {user.username ? (
          <Link href={`/u/${user.username}`} className="font-medium hover:text-primary">
            @{user.username}
          </Link>
        ) : (
          <span className="font-medium">{user.name ?? "User"}</span>
        )}
        {user.name && user.username && <div className="truncate text-xs text-muted">{user.name}</div>}
      </div>
      <div className="ml-auto">
        <FriendButton targetId={user.id} status={status} />
      </div>
    </div>
  );
}
