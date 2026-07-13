"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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
  awayNick: string,
  date: string
): Promise<MatchResult> {
  const row: SeedRow = {
    league: leagueCode,
    date,
    homeTeam: homeNick,
    awayTeam: awayNick,
    venueOverride: null,
    claimedResult: null,
    notes: null,
    needsReview: false,
  };
  const resolver = await buildTeamResolver([leagueCode]);
  return matchRow(row, resolver);
}

/** Match-and-confirm preview — no database writes. */
export async function previewMatch(
  leagueCode: string,
  homeTeamId: number,
  awayTeamId: number,
  date: string
): Promise<PreviewResult> {
  const [home, away] = await Promise.all([
    prisma.team.findUnique({ where: { id: homeTeamId } }),
    prisma.team.findUnique({ where: { id: awayTeamId } }),
  ]);
  if (!home || !away) return { verdict: "no_match", reasons: ["Teams not found."], match: null, duplicateGameId: null };

  const result = await runMatch(leagueCode as LeagueCode, home.nickname, away.nickname, date);

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

  const dup = await prisma.game.findUnique({ where: { espnEventId: result.event.espnEventId } });

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
  awayTeamId: number,
  date: string,
  note: string,
  saveAsReview: boolean
): Promise<SaveResult> {
  const [home, away, league] = await Promise.all([
    prisma.team.findUnique({ where: { id: homeTeamId } }),
    prisma.team.findUnique({ where: { id: awayTeamId } }),
    prisma.league.findFirst({ where: { code: leagueCode } }),
  ]);
  if (!home || !away || !league) return { ok: false, message: "Teams or league not found." };

  const result = await runMatch(leagueCode as LeagueCode, home.nickname, away.nickname, date);

  // Duplicate guard.
  if (result.event) {
    const dup = await prisma.game.findUnique({ where: { espnEventId: result.event.espnEventId } });
    if (dup) return { ok: false, message: "You've already logged this game.", gameId: dup.id };
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
      homeTeamId: matched ? await teamId(result.homeTeamEspnId, homeTeamId) : homeTeamId,
      awayTeamId: matched ? await teamId(result.awayTeamEspnId, awayTeamId) : awayTeamId,
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
      notes: note.trim() || null,
      matchNote: matched ? result.reasons.join(" | ") || null : `logged unconfirmed: ${result.reasons.join("; ")}`,
    },
  });

  // Extract players from the summary into Player/GamePlayer.
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
  const pending = await prisma.game.findMany({
    where: { status: "pending" },
    include: { league: true, homeTeam: true, awayTeam: true },
  });
  let updated = 0;
  for (const g of pending) {
    if (!g.homeTeam || !g.awayTeam) continue;
    const result = await runMatch(
      g.league.code as LeagueCode,
      g.homeTeam.nickname,
      g.awayTeam.nickname,
      g.date.toISOString().slice(0, 10)
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

/** Edit an existing game's core fields (from the game log manage view). */
export async function updateGame(gameId: number, data: UpdateInput): Promise<{ ok: boolean; message: string }> {
  await prisma.game.update({
    where: { id: gameId },
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      homeScore: data.homeScore === "" ? null : Number(data.homeScore),
      awayScore: data.awayScore === "" ? null : Number(data.awayScore),
      status: data.status,
      notes: data.notes.trim() || null,
    },
  });
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/review");
  return { ok: true, message: "Saved." };
}

/** Delete a game entirely. */
export async function deleteGame(gameId: number): Promise<{ ok: boolean }> {
  await prisma.game.delete({ where: { id: gameId } });
  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/review");
  return { ok: true };
}
