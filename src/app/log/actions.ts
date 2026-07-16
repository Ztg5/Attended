"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { buildTeamResolver } from "@/lib/espn/teams";
import { matchRow, MatchResult, SeedRow } from "@/lib/matching";
import { LeagueCode, fetchSummary } from "@/lib/espn/client";
import { syncGamePlayers } from "@/lib/players";
import { lookupVenueCoords } from "@/lib/venue-coords";

export interface PreviewTeam {
  id: number;
  nickname: string;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
}

export interface MatchPreview {
  homeTeam: PreviewTeam | null;
  awayTeam: PreviewTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  date: string; // local game date
  venueName: string | null;
  isPostseason: boolean;
  postseasonRound: string | null;
  wentToOvertime: boolean;
  attendance: number | null;
  espnEventId: string;
  gameStatus: "final" | "pending";
}

export interface PreviewResult {
  verdict: "matched" | "no_match";
  reasons: string[];
  match: MatchPreview | null;
  duplicateGameId: number | null;
}

function bothLeagueTeams(leagueId: number) {
  return prisma.team.findMany({ where: { leagueId } });
}

async function runMatch(
  leagueCode: LeagueCode,
  homeNick: string,
  date: string,
  awayNick: string | null = null
): Promise<MatchResult> {
  const row: SeedRow = {
    league: leagueCode,
    date,
    homeTeam: homeNick,
    awayTeam: awayNick, // null → match on the home team alone
    venueOverride: null,
    claimedResult: null,
    notes: null,
    needsReview: false,
  };
  const resolver = await buildTeamResolver([leagueCode]);
  return matchRow(row, resolver);
}

/** Match-and-confirm preview — no database writes. Only the home team + date are needed. */
export async function previewMatch(
  leagueCode: string,
  homeTeamId: number,
  date: string
): Promise<PreviewResult> {
  const userId = await requireUserId();
  const home = await prisma.team.findUnique({ where: { id: homeTeamId } });
  if (!home) return { verdict: "no_match", reasons: ["Team not found."], match: null, duplicateGameId: null };

  const result = await runMatch(leagueCode as LeagueCode, home.nickname, date);

  if (!result.event) {
    return { verdict: "no_match", reasons: result.reasons, match: null, duplicateGameId: null };
  }

  // Map ESPN's home/away back to DB teams.
  const leagueId = home.leagueId;
  const teamByEspn = async (espnId: string | null) =>
    espnId
      ? await prisma.team.findFirst({ where: { leagueId, espnTeamId: espnId } })
      : null;
  const [dbHome, dbAway] = await Promise.all([
    teamByEspn(result.homeTeamEspnId),
    teamByEspn(result.awayTeamEspnId),
  ]);

  // A "duplicate" now means THIS user already logged the game — the game row itself
  // is global and shared, so another user having it is fine (they'd just add attendance).
  const existing = await prisma.game.findUnique({
    where: { espnEventId: result.event.espnEventId },
    select: { id: true, attendances: { where: { userId }, select: { id: true } } },
  });
  const dup = existing && existing.attendances.length > 0 ? { id: existing.id } : null;

  const toPreviewTeam = (t: typeof home | null): PreviewTeam | null =>
    t ? { id: t.id, nickname: t.nickname, name: t.name, abbreviation: t.abbreviation, logoUrl: t.logoUrl } : null;

  return {
    verdict: "matched",
    reasons: result.reasons,
    duplicateGameId: dup?.id ?? null,
    match: {
      homeTeam: toPreviewTeam(dbHome),
      awayTeam: toPreviewTeam(dbAway),
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      date: result.matchedDate ?? date,
      venueName: result.venue?.name ?? null,
      isPostseason: result.isPostseason,
      postseasonRound: result.postseasonRound,
      wentToOvertime: result.wentToOvertime,
      attendance: result.attendance,
      espnEventId: result.event.espnEventId,
      gameStatus: result.event.isFinal ? "final" : "pending",
    },
  };
}

export interface SaveResult {
  ok: boolean;
  message: string;
  gameId?: number;
}

/**
 * Persist a logged game. Re-runs the match for authoritative data. `saveAsReview`
 * forces needs_review (used when the user saves an unconfirmed game anyway).
 */
export async function saveLoggedGame(
  leagueCode: string,
  homeTeamId: number,
  date: string,
  note: string,
  saveAsReview: boolean
): Promise<SaveResult> {
  const userId = await requireUserId();
  const [home, league] = await Promise.all([
    prisma.team.findUnique({ where: { id: homeTeamId } }),
    prisma.league.findFirst({ where: { code: leagueCode } }),
  ]);
  if (!home || !league) return { ok: false, message: "Team or league not found." };

  const result = await runMatch(leagueCode as LeagueCode, home.nickname, date);
  const noteVal = note.trim() || null;

  // If this real-world game already exists (someone logged it, or you did), don't
  // re-fetch it — just attach THIS user's attendance. Games are global and shared.
  if (result.event) {
    const existing = await prisma.game.findUnique({
      where: { espnEventId: result.event.espnEventId },
      select: { id: true, attendances: { where: { userId }, select: { id: true } } },
    });
    if (existing) {
      if (existing.attendances.length > 0)
        return { ok: false, message: "You've already logged this game.", gameId: existing.id };
      await prisma.attendance.create({ data: { userId, gameId: existing.id, notes: noteVal } });
      revalidatePath("/");
      revalidatePath("/games");
      return { ok: true, gameId: existing.id, message: "Added to your log." };
    }
  }

  const leagueId = league.id;
  const teamId = async (espnId: string | null, fallback: number) => {
    if (!espnId) return fallback;
    const t = await prisma.team.findFirst({ where: { leagueId, espnTeamId: espnId }, select: { id: true } });
    return t?.id ?? fallback;
  };

  let venueId: number | null = null;
  if (result.venue?.espnVenueId) {
    const coords = lookupVenueCoords(result.venue.name); // so new stadiums get a map pin
    const v = await prisma.venue.upsert({
      where: { espnVenueId: result.venue.espnVenueId },
      create: {
        espnVenueId: result.venue.espnVenueId,
        name: result.venue.name ?? "Unknown venue",
        city: result.venue.city,
        state: result.venue.state,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      },
      update: { name: result.venue.name ?? undefined, city: result.venue.city, state: result.venue.state },
    });
    venueId = v.id;
  }

  const matched = Boolean(result.event);
  const status = saveAsReview || !matched ? "needs_review" : result.event!.isFinal ? "final" : "pending";
  const dateOnly = result.matchedDate ?? date;

  // Fetch the full summary (box score) so the detail view and player tracking work
  // for newly-logged games, same as imported ones. Best-effort.
  let summary: unknown = null;
  if (result.event) {
    try {
      summary = await fetchSummary(leagueCode as LeagueCode, result.event.espnEventId);
    } catch {
      /* summary is optional; keep the scoreboard details */
    }
  }
  const detailsJson = summary
    ? { scoreboard: result.event?.details ?? null, summary }
    : result.event?.details ?? undefined;

  const game = await prisma.game.create({
    data: {
      leagueId,
      date: new Date(`${dateOnly}T00:00:00Z`),
      seasonYear: result.seasonYear,
      // On a match both teams come from ESPN; unmatched saves keep only the picked team.
      homeTeamId: matched ? await teamId(result.homeTeamEspnId, homeTeamId) : homeTeamId,
      awayTeamId: matched ? await teamId(result.awayTeamEspnId, homeTeamId) : null,
      venueId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      status,
      espnEventId: result.event?.espnEventId ?? null,
      isPostseason: result.isPostseason,
      postseasonRound: result.postseasonRound,
      wentToOvertime: result.wentToOvertime,
      attendance: result.attendance,
      detailsJson: detailsJson as any,
      matchNote: matched ? result.reasons.join(" | ") || null : `logged unconfirmed: ${result.reasons.join("; ")}`,
    },
  });

  // Attach this user's attendance (personal note lives here, not on the shared game).
  await prisma.attendance.create({ data: { userId, gameId: game.id, notes: noteVal } });

  // Extract players from the summary into Player/GamePlayer (global tables).
  if (summary) {
    try {
      await syncGamePlayers(game.id, leagueId, summary);
    } catch {
      /* player extraction is best-effort */
    }
  }

  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/review");
  return {
    ok: true,
    gameId: game.id,
    message:
      status === "pending"
        ? "Saved as pending — refresh it after the game ends."
        : status === "needs_review"
        ? "Saved for review — confirm it on the review screen."
        : "Game saved.",
  };
}

/** Re-fetch every pending game and finalize any that are now complete. */
export async function refreshPending(): Promise<{ ok: boolean; updated: number; message: string }> {
  const userId = await requireUserId();
  const pending = await prisma.game.findMany({
    where: { status: "pending", attendances: { some: { userId } } },
    include: { league: true, homeTeam: true, awayTeam: true },
  });
  let updated = 0;
  for (const g of pending) {
    if (!g.homeTeam || !g.awayTeam) continue;
    const result = await runMatch(
      g.league.code as LeagueCode,
      g.homeTeam.nickname,
      g.date.toISOString().slice(0, 10),
      g.awayTeam.nickname
    );
    if (result.event?.isFinal) {
      await prisma.game.update({
        where: { id: g.id },
        data: {
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          wentToOvertime: result.wentToOvertime,
          attendance: result.attendance,
          status: "final",
          matchNote: result.reasons.join(" | ") || null,
        },
      });
      updated++;
    }
  }
  revalidatePath("/");
  revalidatePath("/games");
  return {
    ok: true,
    updated,
    message: updated ? `Finalized ${updated} game${updated === 1 ? "" : "s"}.` : "No pending games are final yet.",
  };
}

export interface UpdateInput {
  date: string;
  homeScore: string;
  awayScore: string;
  status: string;
  notes: string;
}

/**
 * Edit from the game-log manage view. Score/date/status are shared game data; the
 * note is personal and upserted onto the user's Attendance row.
 */
export async function updateGame(gameId: number, data: UpdateInput): Promise<{ ok: boolean; message: string }> {
  const userId = await requireUserId();
  await prisma.game.update({
    where: { id: gameId },
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      homeScore: data.homeScore === "" ? null : Number(data.homeScore),
      awayScore: data.awayScore === "" ? null : Number(data.awayScore),
      status: data.status,
    },
  });
  await prisma.attendance.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId, notes: data.notes.trim() || null },
    update: { notes: data.notes.trim() || null },
  });
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/review");
  return { ok: true, message: "Saved." };
}

export interface FavoriteResult {
  ok: boolean;
  favorited: boolean;
  message: string;
}

const MAX_FAVORITES = 4;

/**
 * Toggle a game as one of the user's favorites (capped at MAX_FAVORITES). Only games the
 * user attended can be favorited — the flag lives on their Attendance row.
 */
export async function toggleFavorite(gameId: number): Promise<FavoriteResult> {
  const userId = await requireUserId();
  const att = await prisma.attendance.findUnique({
    where: { userId_gameId: { userId, gameId } },
    select: { id: true, favoritedAt: true },
  });
  if (!att) return { ok: false, favorited: false, message: "Log this game before favoriting it." };

  if (att.favoritedAt) {
    await prisma.attendance.update({ where: { id: att.id }, data: { favoritedAt: null } });
    revalidatePath("/");
    revalidatePath(`/games/${gameId}`);
    return { ok: true, favorited: false, message: "Removed from favorites." };
  }

  const count = await prisma.attendance.count({ where: { userId, favoritedAt: { not: null } } });
  if (count >= MAX_FAVORITES) {
    return { ok: false, favorited: false, message: `You can only favorite ${MAX_FAVORITES} games.` };
  }
  await prisma.attendance.update({ where: { id: att.id }, data: { favoritedAt: new Date() } });
  revalidatePath("/");
  revalidatePath(`/games/${gameId}`);
  return { ok: true, favorited: true, message: "Added to favorites." };
}

/**
 * Remove the game from THIS user's log (delete their Attendance). The global game row
 * is left intact — other users may have attended it, and it's the shared catalog.
 */
export async function deleteGame(gameId: number): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await prisma.attendance.deleteMany({ where: { userId, gameId } });
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/review");
  return { ok: true };
}
