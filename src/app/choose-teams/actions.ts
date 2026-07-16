"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/** Replace the user's favorite teams with the given set. Records/streaks track these. */
export async function setFavoriteTeams(teamIds: number[]): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { favoriteTeams: { set: teamIds.map((id) => ({ id })) } },
  });
  revalidatePath("/");
  return { ok: true };
}
