import { cache } from "react";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getPublicDashboard, getBannerTeam, type DashboardData, type TeamLite } from "@/lib/stats";
import { getChecklist } from "@/lib/collection";
import type { CollectionPreview } from "@/lib/social";

/**
 * Public profile sharing.
 *
 * A share link is an unguessable token, not a username — so a profile is only
 * reachable by someone the owner actually sent the link to, and revoking the
 * token kills every copy of it. Profiles are private by default (`shareToken`
 * is null until the owner opts in).
 *
 * The view NEVER includes private notes: it reads through `getPublicDashboard`,
 * which selects games without the Attendance join. See stats.ts.
 */

/** 72 bits of entropy, URL-safe, ~12 chars. Not sequential, not enumerable. */
export function newShareToken(): string {
  return randomBytes(9).toString("base64url");
}

export interface ShareView {
  user: { username: string | null; name: string | null; image: string | null };
  dashboard: DashboardData;
  collection: CollectionPreview[];
  /** Most-seen favorite team — drives the Zubaz banner. */
  bannerTeam: TeamLite | null;
}

/**
 * Resolve a share token to its owner's public dashboard highlights. Null if unknown.
 *
 * `cache()` dedupes within a request: generateMetadata and the page both need
 * this, and without it every share view would run the whole aggregate twice.
 */
export const getShareView = cache(async (token: string): Promise<ShareView | null> => {
  const clean = token?.trim();
  if (!clean) return null;

  const user = await prisma.user.findUnique({
    where: { shareToken: clean },
    select: { id: true, username: true, name: true, image: true },
  });
  if (!user) return null;

  const [dashboard, checklist, bannerTeam] = await Promise.all([
    getPublicDashboard(user.id),
    getChecklist(user.id),
    getBannerTeam(user.id),
  ]);

  return {
    user: { username: user.username, name: user.name, image: user.image },
    dashboard,
    collection: checklist.map((l) => ({ code: l.code, seen: l.seen, total: l.total })),
    bannerTeam,
  };
});
