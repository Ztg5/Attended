import { prisma } from "../src/lib/db";

async function main() {
  const games = await prisma.game.count();
  const byLeague = await prisma.game.groupBy({ by: ["leagueId"], _count: true });
  const byStatus = await prisma.game.groupBy({ by: ["status"], _count: true });
  const venues = await prisma.venue.count();
  const teams = await prisma.team.count();
  const withScore = await prisma.game.count({ where: { homeScore: { not: null } } });
  const nullVenue = await prisma.game.count({ where: { venueId: null } });
  const leagues = await prisma.league.findMany({ select: { id: true, code: true } });
  const code = Object.fromEntries(leagues.map((l) => [l.id, l.code]));

  const topVenue = await prisma.game.groupBy({
    by: ["venueId"],
    _count: true,
    orderBy: { _count: { venueId: "desc" } },
    take: 1,
  });
  const v = topVenue[0].venueId
    ? await prisma.venue.findUnique({ where: { id: topVenue[0].venueId } })
    : null;

  console.log("games total:", games, "| with real score:", withScore, "| null venue:", nullVenue);
  console.log("by league:", byLeague.map((g) => code[g.leagueId] + ":" + g._count).join("  "));
  console.log("by status:", byStatus.map((s) => s.status + ":" + s._count).join("  "));
  console.log("distinct venues:", venues, "| teams seeded:", teams);
  console.log("busiest venue:", v && `${v.name} (espnId ${v.espnVenueId}) — ${topVenue[0]._count} games`);

  const bills = await prisma.team.findFirst({ where: { nickname: "Bills" } });
  if (bills) {
    const g = await prisma.game.findMany({
      where: { OR: [{ homeTeamId: bills.id }, { awayTeamId: bills.id }] },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const opp = new Set<number>();
    g.forEach((x) => {
      if (x.homeTeamId && x.homeTeamId !== bills.id) opp.add(x.homeTeamId);
      if (x.awayTeamId && x.awayTeamId !== bills.id) opp.add(x.awayTeamId);
    });
    console.log("Bills games:", g.length, "| distinct opponents collected:", opp.size);
  }

  await prisma.$disconnect();
}

main();
