import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export interface SessionUser {
  id: string;
  username: string | null;
}

/** The signed-in user's id + username, or a redirect to /sign-in. Does NOT require a username. */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true },
  });
  if (!user) redirect("/sign-in");
  return user;
}

/**
 * The signed-in user's id for scoping queries. Also enforces that they've picked a
 * username (redirect to /choose-username if not) — every social feature keys off it.
 */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user.username) redirect("/choose-username");
  return user.id;
}
