import Link from "next/link";
import { UserRound } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * Signed-in identity for the dashboard masthead — a link to your own profile.
 * Sign-out lives on that profile page (top right), not here.
 */
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
    </div>
  );
}
