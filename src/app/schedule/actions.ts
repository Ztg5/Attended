"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  EspnEvent,
  LeagueCode,
  fetchTeamScheduleCached,
  fetchScoreboard,
  fetchSummary,
  wentToOvertime,
} from "@/lib/espn/client";
import { syncGamePlayers } from "@/lib/players";
import { lookupVenueCoords } from "@/lib/venue-coords";

export interface ScheduleTeamRef {
  id: number;
  name: string;
  abbreviation: string;
  logoUrl: string | null;
}

export interface ScheduleGameItem {
  espnEventId: string;
  dateIso: string;
  isPostseason: boolean;
  postseasonRound: string | null;
  isFinal: boolean;
  isHomeGame: boolean;
  homeTeam: ScheduleTeamRef | null;
  awayTeam: ScheduleTeamRef | null;
  homeScore: number | null;
  awayScore: number | null;
  venueName: string | null;
  alreadyLogged: boolean;
}

/** A team's season schedule (ESPN, 24h cached) annotated with this user's logged status. */
export async function getTeamSchedule(
  leagueCode: string,
  espnTeamId: string,
  season: number
): Promise<ScheduleGameItem[]> {
  const userId = await requireUserId();
  const league = await prisma.league.findFirst({ where: { code: leagueCode } });
  if (!league) return [];

  const events = await fetchTeamScheduleCached(leagueCode as LeagueCode, espnTeamId, season);
  if (!events.length) return [];

  const dbTeams = await prisma.team.findMany({
    where: { leagueId: league.id },
    select: { id: true, espnTeamId: true, name: true, abbreviation: true, logoUrl: true },
  });
  const teamByEspn = new Map(dbTeams.map((t) => [t.espnTeamId, t]));

  const existing = await prisma.game.findMany({
    where: { espnEventId: { in: events.map((e) => e.espnEventId) } },
    select: { espnEventId: true, attendances: { where: { userId }, select: { id: true } } },
  });
  const loggedSet = new Set(
    existing.filter((g) => g.attendances.length > 0).map((g) => g.espnEventId!)
  );

  const toRef = (espnId: string | null): ScheduleTeamRef | null => {
    if (!espnId) return null;
    const t = teamByEspn.get(espnId);
    return t ? { id: t.id, name: t.name, abbreviation: t.abbreviation, logoUrl: t.logoUrl } : null;
  };

  return events
    .map((e): ScheduleGameItem => {
      const home = e.competitors.find((c) => c.homeAway === "home") ?? null;
      const away = e.competitors.find((c) => c.homeAway === "away") ?? null;
      return {
        espnEventId: e.espnEventId,
        dateIso: e.dateIso,
        isPostseason: e.isPostseason,
        postseasonRound: e.postseasonRound,
        isFinal: e.isFinal,
        isHomeGame: home?.espnTeamId === espnTeamId,
        homeTeam: toRef(home?.espnTeamId ?? null),
        awayTeam: toRef(away?.espnTeamId ?? null),
        homeScore: home?.score ?? null,
        awayScore: away?.score ?? null,
        venueName: e.venue.name,
        alreadyLogged: loggedSet.has(e.espnEventId),
      };
    })
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

function shiftDate(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The schedule endpoint's dateIso is a UTC instant, which can land a day off the
 * local scoreboard date for night games. Confirm the real date the way the import
 * matcher does: check the scoreboard for the naive date and its neighbors.
 */
async function resolveLocalDate(league: LeagueCode, event: EspnEvent): Promise<string> {
  const naive = event.dateIso.slice(0, 10);
  for (const d of [naive, shiftDate(naive, -1), shiftDate(naive, 1)]) {
    try {
      const events = await fetchScoreboard(league, d);
      if (events.some((e) => e.espnEventId === event.espnEventId)) return d;
    } catch {
      /* try the next candidate */
    }
  }
  return naive;
}

export interface BatchAddResult {
  ok: boolean;
  added: number;
  skipped: number;
  message: string;
}

/** Find-or-create a Game + Attendance for each selected event. Mirrors log/actions.ts. */
export async function batchAddGames(
  leagueCode: string,
  espnTeamId: string,
  season: number,
  espnEventIds: string[]
): Promise<BatchAddResult> {
  const userId = await requireUserId();
  const league = await prisma.league.findFirst({ where: { code: leagueCode } });
  if (!league || espnEventIds.length === 0) {
    return { ok: false, added: 0, skipped: 0, message: "Nothing to add." };
  }
  const leagueId = league.id;

  const events = await fetchTeamScheduleCached(leagueCode as LeagueCode, espnTeamId, season);
  const selected = events.filter((e) => espnEventIds.includes(e.espnEventId));

  const playerCache = new Map<string, number>();
  let added = 0;
  let skipped = 0;

  for (const event of selected) {
    const existing = await prisma.game.findUnique({
      where: { espnEventId: event.espnEventId },
      select: { id: true, attendances: { where: { userId }, select: { id: true } } },
    });

    if (existing) {
      if (existing.attendances.length > 0) {
        skipped++;
        continue;
      }
      await prisma.attendance.create({ data: { userId, gameId: existing.id } });
      added++;
      continue;
    }

    const home = event.competitors.find((c) => c.homeAway === "home") ?? null;
    const away = event.competitors.find((c) => c.homeAway === "away") ?? null;
    const teamId = async (espnId: string | null) => {
      if (!espnId) return null;
      const t = await prisma.team.findFirst({ where: { leagueId, espnTeamId: espnId }, select: { id: true } });
      return t?.id ?? null;
    };
    const [homeTeamId, awayTeamId] = await Promise.all([teamId(home?.espnTeamId ?? null), teamId(away?.espnTeamId ?? null)]);

    let venueId: number | null = null;
    if (event.venue.espnVenueId) {
      const coords = lookupVenueCoords(event.venue.name);
      const v = await prisma.venue.upsert({
        where: { espnVenueId: event.venue.espnVenueId },
        create: {
          espnVenueId: event.venue.espnVenueId,
          name: event.venue.name ?? "Unknown venue",
          city: event.venue.city,
          state: event.venue.state,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        },
        update: { name: event.venue.name ?? undefined, city: event.venue.city, state: event.venue.state },
      });
      venueId = v.id;
    }

    // Best-effort box score for the detail view + player tracking.
    let summary: unknown = null;
    try {
      summary = await fetchSummary(leagueCode as LeagueCode, event.espnEventId);
    } catch {
      /* summary is optional; keep the scoreboard details */
    }
    const detailsJson = summary ? { scoreboard: event.details, summary } : event.details;
    const dateOnly = await resolveLocalDate(leagueCode as LeagueCode, event);

    const game = await prisma.game.create({
      data: {
        leagueId,
        date: new Date(`${dateOnly}T00:00:00Z`),
        seasonYear: event.seasonYear,
        homeTeamId,
        awayTeamId,
        venueId,
        homeScore: home?.score ?? null,
        awayScore: away?.score ?? null,
        status: event.isFinal ? "final" : "pending",
        espnEventId: event.espnEventId,
        isPostseason: event.isPostseason,
        postseasonRound: event.postseasonRound,
        wentToOvertime: wentToOvertime(leagueCode as LeagueCode, event.period),
        attendance: event.attendance,
        detailsJson: detailsJson as any,
      },
    });

    await prisma.attendance.create({ data: { userId, gameId: game.id } });

    if (summary) {
      try {
        await syncGamePlayers(game.id, leagueId, summary, playerCache);
      } catch {
        /* player extraction is best-effort */
      }
    }

    added++;
  }

  revalidatePath("/");
  revalidatePath("/games");
  revalidatePath("/review");
  revalidatePath("/schedule");

  return {
    ok: true,
    added,
    skipped,
    message:
      added > 0
        ? `Added ${added} game${added === 1 ? "" : "s"}${skipped ? ` (${skipped} already logged)` : ""}.`
        : "Already logged — nothing new to add.",
  };
}
