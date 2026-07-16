"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export interface FriendActionResult {
  ok: boolean;
  message: string;
}

function refresh() {
  revalidatePath("/people");
  revalidatePath("/", "layout"); // profile pages (/u/[username]) + nav badges
}

/** Send a friend request. If they already requested me, accept it (become friends). */
export async function sendFriendRequest(targetId: string): Promise<FriendActionResult> {
  const me = await requireUserId();
  if (targetId === me) return { ok: false, message: "That's you." };

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: me, addresseeId: targetId },
        { requesterId: targetId, addresseeId: me },
      ],
    },
  });

  if (existing) {
    if (existing.status === "accepted") return { ok: false, message: "You're already friends." };
    if (existing.requesterId === me) return { ok: false, message: "Request already sent." };
    // They requested me first — accept it.
    await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: "accepted", respondedAt: new Date() },
    });
    refresh();
    return { ok: true, message: "You're now friends." };
  }

  await prisma.friendship.create({ data: { requesterId: me, addresseeId: targetId } });
  refresh();
  return { ok: true, message: "Request sent." };
}

/** Accept a pending incoming request from `requesterId`. */
export async function acceptFriendRequest(requesterId: string): Promise<FriendActionResult> {
  const me = await requireUserId();
  const res = await prisma.friendship.updateMany({
    where: { requesterId, addresseeId: me, status: "pending" },
    data: { status: "accepted", respondedAt: new Date() },
  });
  refresh();
  return res.count > 0
    ? { ok: true, message: "Friend added." }
    : { ok: false, message: "No pending request." };
}

/** Decline an incoming request (removes it; they may request again later). */
export async function declineFriendRequest(requesterId: string): Promise<FriendActionResult> {
  const me = await requireUserId();
  await prisma.friendship.deleteMany({ where: { requesterId, addresseeId: me, status: "pending" } });
  refresh();
  return { ok: true, message: "Request declined." };
}

/** Cancel a request I sent to `targetId`. */
export async function cancelFriendRequest(targetId: string): Promise<FriendActionResult> {
  const me = await requireUserId();
  await prisma.friendship.deleteMany({ where: { requesterId: me, addresseeId: targetId, status: "pending" } });
  refresh();
  return { ok: true, message: "Request canceled." };
}

/** Remove an existing friend (either direction). */
export async function removeFriend(otherId: string): Promise<FriendActionResult> {
  const me = await requireUserId();
  await prisma.friendship.deleteMany({
    where: {
      status: "accepted",
      OR: [
        { requesterId: me, addresseeId: otherId },
        { requesterId: otherId, addresseeId: me },
      ],
    },
  });
  refresh();
  return { ok: true, message: "Friend removed." };
}
