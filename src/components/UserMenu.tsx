import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";

/** Signed-in identity: link to own profile + sign-out, for the dashboard masthead. */
export async function UserMenu() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true },
  });
  const label = me?.username ? `@${me.username}` : me?.name ?? "You";

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={me?.username ? `/u/${me.username}` : "/choose-username"}
        title="Your profile"
        aria-label={`Your profile (${label})`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <UserRound size={15} />
        <span className="hidden max-w-[9rem] truncate sm:inline">{label}</span>
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </form>
    </div>
  );
}
