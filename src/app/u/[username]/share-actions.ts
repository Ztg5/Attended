"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { newShareToken } from "@/lib/share";

/**
 * Share-link mutations. Both act ONLY on the caller's own row — the user id
 * comes from the session, never from an argument, so one user can't mint or
 * revoke another user's link.
 */

export async function createShareLink(): Promise<{ token: string }> {
  const userId = await requireUserId();
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { shareToken: true, username: true },
  });
  // Idempotent: re-using "share" shouldn't invalidate a link already sent out.
  const token = existing?.shareToken ?? newShareToken();
  if (!existing?.shareToken) {
    await prisma.user.update({ where: { id: userId }, data: { shareToken: token } });
  }
  if (existing?.username) revalidatePath(`/u/${existing.username}`);
  return { token };
}

