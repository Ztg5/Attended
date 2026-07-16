"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { buildTeamResolver } from "@/lib/espn/teams";
import { matchRow, SeedRow } from "@/lib/matching";
import { LeagueCode } from "@/lib/espn/client";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Re-run the ESPN match for a flagged game and refresh its data in place. */
export async function rerunMatch(gameId: number): Promise<ActionResult> {
  const userId = await requireUserId();
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      league: true,
      homeTeam: true,
      awayTeam: true,
      attendances: { where: { userId }, select: { notes: true } },
    },
  });
  if (!game || !game.homeTeam || !game.awayTeam) {
    return { ok: false, message: "Can't re-run — the game is missing its teams." };
  }

  const league = game.league.code as LeagueCode;
  const row: SeedRow = {
    league,
    date: game.date.toISOString().slice(0, 10),
    homeTeam: game.homeTeam.nickname,
    awayTeam: game.awayTeam.nickname,
    venueOverride: null,
    claimedResult: game.claimedResult,
    notes: game.attendances[0]?.notes ?? null, // only used as a season-year hint
    needsReview: false, // we want an honest fresh verdict
  };

  const resolver = await buildTeamResolver([league]);
  const result = await matchRow(row, resolver);

  if (!result.event) {
    await prisma.game.update({
      where: { id: gameId },
      data: { matchNote: result.reasons.join(" | ") || "no ESPN match" },
    });
    revalidatePath("/review");
  revalidatePath("/");
  revalidatePath("/games");
    return { ok: false, message: `Still no match: ${result.reasons.join("; ")}` };
  }

  const teamId = async (espnId: string | null) =>
    espnId
      ? (await prisma.team.findFirst({
          where: { leagueId: game.leagueId, espnTeamId: espnId },
          select: { id: true },
        }))?.id ?? null
      : null;

  let venueId = game.venueId;
  if (result.venue?.espnVenueId) {
    const v = await prisma.venue.upsert({
      where: { espnVenueId: result.venue.espnVenueId },
      create: {
        espnVenueId: result.venue.espnVenueId,
        name: result.venue.name ?? "Unknown venue",
        city: result.venue.city,
        state: result.venue.state,
      },
      update: { name: result.venue.name ?? undefined, city: result.venue.city, state: result.venue.state },
    });
    venueId = v.id;
  }

  await prisma.game.update({
    where: { id: gameId },
    data: {
      // local game date (scoreboard bucket), not the UTC datetime — see import notes
      date: new Date(`${result.matchedDate ?? result.event.dateIso.slice(0, 10)}T00:00:00Z`),
      seasonYear: result.seasonYear,
      homeTeamId: await teamId(result.homeTeamEspnId),
      awayTeamId: await teamId(result.awayTeamEspnId),
      venueId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      espnEventId: result.event.espnEventId,
      isPostseason: result.isPostseason,
      postseasonRound: result.postseasonRound,
      wentToOvertime: result.wentToOvertime,
      attendance: result.attendance,
      matchNote: result.reasons.join(" | ") || null,
    },
  });

  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath("/games");
  return {
    ok: true,
    message: `Matched: ${result.awayScore ?? "?"}–${result.homeScore ?? "?"}${
      result.venue?.name ? ` @ ${result.venue.name}` : ""
    }. Review the fields and mark it reviewed.`,
  };
}

export interface SaveInput {
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: string;
  awayScore: string;
  status: string;
  notes: string;
}

/** Persist manual edits from the review form. Game fields are shared; note is personal. */
export async function saveGame(gameId: number, data: SaveInput): Promise<ActionResult> {
  const userId = await requireUserId();
  await prisma.game.update({
    where: { id: gameId },
    data: {
      date: new Date(`${data.date}T00:00:00Z`),
      homeTeamId: Number(data.homeTeamId),
      awayTeamId: Number(data.awayTeamId),
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
  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath("/games");
  return { ok: true, message: "Saved." };
}

/** Clear a game out of review — mark it final. */
export async function markReviewed(gameId: number): Promise<ActionResult> {
  await requireUserId();
  await prisma.game.update({ where: { id: gameId }, data: { status: "final" } });
  revalidatePath("/review");
  revalidatePath("/");
  revalidatePath("/games");
  return { ok: true, message: "Marked reviewed." };
}
