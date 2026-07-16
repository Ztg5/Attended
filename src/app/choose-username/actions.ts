"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export interface SetUsernameResult {
  ok: boolean;
  message: string;
  next?: string; // where the client should navigate on success
}

/** Set or change the signed-in user's username. Lowercased, 3–20 chars, [a-z0-9_], unique. */
export async function setUsername(raw: string): Promise<SetUsernameResult> {
  const me = await getSessionUser();
  const username = raw.trim().toLowerCase();

  if (!USERNAME_RE.test(username)) {
    return { ok: false, message: "3–20 characters, letters/numbers/underscore only." };
  }

  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (taken && taken.id !== me.id) {
    return { ok: false, message: "That username is taken." };
  }

  await prisma.user.update({ where: { id: me.id }, data: { username } });
  revalidatePath("/");
  revalidatePath("/people");

  // New users (no favorite teams yet) continue to the teams step; editors go home.
  const fav = await prisma.user.findUnique({
    where: { id: me.id },
    select: { _count: { select: { favoriteTeams: true } } },
  });
  const next = (fav?._count.favoriteTeams ?? 0) === 0 ? "/choose-teams?onboarding=1" : "/";
  return { ok: true, message: "Saved.", next };
}
