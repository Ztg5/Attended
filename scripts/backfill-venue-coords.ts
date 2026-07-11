/**
 * Backfill Venue latitude/longitude. ESPN exposes no coordinates (only city/state),
 * so these are curated for the venues attended so far. Keyed by a substring of the
 * ESPN venue name; add a line here when a new stadium shows up.
 *
 *   npx tsx --env-file=.env scripts/backfill-venue-coords.ts
 */
import { prisma } from "../src/lib/db";

const COORDS: { match: string; lat: number; lng: number }[] = [
  { match: "Highmark Stadium", lat: 42.7738, lng: -78.787 }, // Orchard Park, NY (Bills)
  { match: "Huntington Bank Field", lat: 41.5061, lng: -81.6995 }, // Cleveland (Browns)
  { match: "Hard Rock Stadium", lat: 25.958, lng: -80.2389 }, // Miami Gardens (Dolphins)
  { match: "Ford Field", lat: 42.34, lng: -83.0456 }, // Detroit
  { match: "Progressive Field", lat: 41.4962, lng: -81.6852 }, // Cleveland (Guardians)
  { match: "Rocket Arena", lat: 41.4966, lng: -81.6881 }, // Cleveland (Cavaliers)
  { match: "Wrigley Field", lat: 41.9484, lng: -87.6553 }, // Chicago (Cubs)
  { match: "Kaseya Center", lat: 25.7814, lng: -80.187 }, // Miami (Heat)
  { match: "Sahlen Field", lat: 42.8795, lng: -78.8738 }, // Buffalo (Blue Jays 2021)
];

async function main() {
  const venues = await prisma.venue.findMany();
  let updated = 0;
  const missing: string[] = [];

  for (const v of venues) {
    const hit = COORDS.find((c) => v.name.includes(c.match));
    if (hit) {
      await prisma.venue.update({
        where: { id: v.id },
        data: { latitude: hit.lat, longitude: hit.lng },
      });
      updated++;
    } else if (v.latitude == null) {
      missing.push(v.name);
    }
  }

  console.log(`Set coordinates on ${updated} venue(s).`);
  if (missing.length) console.log(`No coords for: ${missing.join(", ")} (add to COORDS).`);
  await prisma.$disconnect();
}

main();
