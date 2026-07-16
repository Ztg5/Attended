"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Clock, Check, X } from "lucide-react";
import { Button } from "./Button";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from "@/app/people/actions";

export type FriendStatus = "self" | "friends" | "incoming" | "outgoing" | "none";

/** The right friend control(s) for a given relationship, from the viewer's side. */
export function FriendButton({
  targetId,
  status,
  size = "sm",
}: {
  targetId: string;
  status: FriendStatus;
  size?: "sm" | "md";
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  if (status === "self") return null;

  if (status === "friends")
    return (
      <Button variant="secondary" size={size} disabled={pending} onClick={() => run(() => removeFriend(targetId))}>
        <UserCheck size={14} /> Friends
      </Button>
    );

  if (status === "outgoing")
    return (
      <Button variant="secondary" size={size} disabled={pending} onClick={() => run(() => cancelFriendRequest(targetId))}>
        <Clock size={14} /> Requested
      </Button>
    );

  if (status === "incoming")
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button variant="primary" size={size} disabled={pending} onClick={() => run(() => acceptFriendRequest(targetId))}>
          <Check size={14} /> Accept
        </Button>
        <Button variant="ghost" size={size} disabled={pending} onClick={() => run(() => declineFriendRequest(targetId))}>
          <X size={14} /> Decline
        </Button>
      </span>
    );

  return (
    <Button variant="primary" size={size} disabled={pending} onClick={() => run(() => sendFriendRequest(targetId))}>
      <UserPlus size={14} /> Add friend
    </Button>
  );
}
