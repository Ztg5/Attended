/**
 * Social layer: friend graph (request/accept), profile data for a friend's page, and
 * mutual-games. Read queries only — mutations live in `src/app/people/actions.ts`.
 *
 * Privacy: another user's private notes are NEVER selected here (BASE_GAME_SELECT omits
 * them). Full profile data is only returned to friends (or the user themselves).
 */
import { prisma } from "./db";
import {
  BASE_GAME_SELECT,
  attendedByUser,
  toLite,
  recordOverGames,
  getFollowedTeamIds,
  type GameLite,
  type Record2,
} from "./stats";
import { getChecklist } from "./collection";

export type FriendStatus = "self" | "friends" | "incoming" | "outgoing" | "none";

export interface UserLite {
  id: string;
  username: string | null;
  name: string | null;
  image: string | null;
}

/** The friendship row between two users, in either direction (or null). */
async function friendshipBetween(a: string, b: string) {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
}

export async function friendStatus(viewerId: string, targetId: string): Promise<FriendStatus> {
  if (viewerId === targetId) return "self";
  const f = await friendshipBetween(viewerId, targetId);
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return f.requesterId === viewerId ? "outgoing" : "incoming";
}

// --- lists for the /people screen -------------------------------------------

export async function getIncomingRequests(viewerId: string): Promise<UserLite[]> {
  const rows = await prisma.friendship.findMany({
    where: { addresseeId: viewerId, status: "pending" },
    select: { requester: { select: { id: true, username: true, name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.requester);
}

export async function getOutgoingRequests(viewerId: string): Promise<UserLite[]> {
  const rows = await prisma.friendship.findMany({
    where: { requesterId: viewerId, status: "pending" },
    select: { addressee: { select: { id: true, username: true, name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.addressee);
}

export async function getFriends(viewerId: string): Promise<UserLite[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: viewerId }, { addresseeId: viewerId }] },
    select: {
      requester: { select: { id: true, username: true, name: true, image: true } },
      addressee: { select: { id: true, username: true, name: true, image: true } },
    },
  });
  return rows.map((r) => (r.requester.id === viewerId ? r.addressee : r.requester));
}

export interface SearchResult extends UserLite {
  status: FriendStatus;
}

/** Find users by username or name (excluding the viewer), annotated with friend status. */
export async function searchUsers(query: string, viewerId: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      username: { not: null },
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, name: true, image: true },
    take: 25,
    orderBy: { username: "asc" },
  });

  // One pass over the viewer's friendships to annotate status without N queries.
  const rels = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: viewerId }, { addresseeId: viewerId }] },
    select: { requesterId: true, addresseeId: true, status: true },
  });
  const statusFor = (otherId: string): FriendStatus => {
    const f = rels.find((r) => r.requesterId === otherId || r.addresseeId === otherId);
    if (!f) return "none";
    if (f.status === "accepted") return "friends";
    return f.requesterId === viewerId ? "outgoing" : "incoming";
  };

  return users.map((u) => ({ ...u, status: statusFor(u.id) }));
}

// --- friend profile ---------------------------------------------------------

export interface ProfileStats {
  totalGames: number;
  record: Record2;
  venuesVisited: number;
}
export interface CollectionPreview {
  code: string;
  seen: number;
  total: number;
}
export interface Profile {
  user: UserLite;
  status: FriendStatus;
  /** Populated only when the viewer may see the full profile (friends or self). */
  full: {
    stats: ProfileStats;
    favorites: GameLite[];
    collection: CollectionPreview[];
    sharedCount: number; // games viewer + target both attended (0 when self)
  } | null;
}

/** Games attended by BOTH users (no notes). Newest first. */
export async function getSharedGames(viewerId: string, targetId: string): Promise<GameLite[]> {
  if (viewerId === targetId) return [];
  const games = await prisma.game.findMany({
    where: { AND: [attendedByUser(viewerId), attendedByUser(targetId)] },
    select: BASE_GAME_SELECT,
    orderBy: { date: "desc" },
  });
  return games.map(toLite);
}

export interface SharedGamesView {
  target: UserLite;
  games: GameLite[];
  record: Record2; // combined attending record over the shared games
}

/** The expanded "games you both attended" view — only for accepted friends. */
export async function getSharedGamesView(
  viewerId: string,
  username: string
): Promise<SharedGamesView | null> {
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true, image: true },
  });
  if (!target) return null;
  if ((await friendStatus(viewerId, target.id)) !== "friends") return null;

  const games = await getSharedGames(viewerId, target.id);
  const followedIds = await getFollowedTeamIds(viewerId); // combined record from your perspective
  return { target, games, record: recordOverGames(games, followedIds) };
}

async function favoriteGamesOf(userId: string): Promise<GameLite[]> {
  const rows = await prisma.attendance.findMany({
    where: { userId, favoritedAt: { not: null } },
    orderBy: { favoritedAt: "asc" },
    take: 4,
    select: { game: { select: BASE_GAME_SELECT } },
  });
  return rows.map((r) => toLite(r.game));
}

/** A user's profile by username, from the viewer's perspective. Null if no such user. */
export async function getProfile(username: string, viewerId: string): Promise<Profile | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true, image: true },
  });
  if (!user) return null;

  const status = await friendStatus(viewerId, user.id);
  const canSee = status === "self" || status === "friends";
  if (!canSee) return { user, status, full: null };

  const [games, favorites, checklist, sharedCount] = await Promise.all([
    prisma.game.findMany({ where: attendedByUser(user.id), select: BASE_GAME_SELECT }).then((gs) => gs.map(toLite)),
    favoriteGamesOf(user.id),
    getChecklist(user.id),
    status === "self"
      ? Promise.resolve(0)
      : prisma.game.count({ where: { AND: [attendedByUser(viewerId), attendedByUser(user.id)] } }),
  ]);

  const followedIds = await getFollowedTeamIds(user.id); // the profile owner's own teams
  const stats: ProfileStats = {
    totalGames: games.length,
    record: recordOverGames(games, followedIds),
    venuesVisited: new Set(games.map((g) => g.venueName).filter(Boolean)).size,
  };
  const collection: CollectionPreview[] = checklist.map((l) => ({ code: l.code, seen: l.seen, total: l.total }));

  return { user, status, full: { stats, favorites, collection, sharedCount } };
}
