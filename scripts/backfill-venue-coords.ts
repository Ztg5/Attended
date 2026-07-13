/**
 * Backfill Venue latitude/longitude from the curated table in src/lib/venue-coords.ts.
 * ESPN exposes no coordinates, so they're hand-set there.
 *
 *   npx tsx --env-file=.env scripts/backfill-venue-coords.ts
 */
import { prisma } from "../src/lib/db";
import { lookupVenueCoords } from "../src/lib/venue-coords";

async function main() {
  const venues = await prisma.venue.findMany();
  let updated = 0;
  const missing: string[] = [];

  for (const v of venues) {
    const c = lookupVenueCoords(v.name);
    if (c) {
      await prisma.venue.update({ where: { id: v.id }, data: { latitude: c.lat, longitude: c.lng } });
      updated++;
    } else if (v.latitude == null) {
      missing.push(v.name);
    }
  }

  console.log(`Set coordinates on ${updated} venue(s).`);
  if (missing.length) console.log(`No coords for: ${missing.join(", ")} (add to src/lib/venue-coords.ts).`);
  await prisma.$disconnect();
}

main();
