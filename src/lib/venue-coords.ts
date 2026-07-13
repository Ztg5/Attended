/**
 * Curated venue coordinates. ESPN exposes no lat/long, so these are hand-set and
 * matched by a substring of the ESPN venue name. Used both by the one-time backfill
 * and by the log-a-game flow (so a newly-attended stadium gets a map pin immediately,
 * as long as it's listed here). Add a line when a new venue shows up.
 */
const COORDS: { match: string; lat: number; lng: number }[] = [
  // --- venues attended ---
  { match: "Highmark Stadium", lat: 42.7738, lng: -78.787 }, // Bills (Orchard Park)
  { match: "Huntington Bank Field", lat: 41.5061, lng: -81.6995 }, // Browns
  { match: "Hard Rock Stadium", lat: 25.958, lng: -80.2389 }, // Dolphins
  { match: "Ford Field", lat: 42.34, lng: -83.0456 }, // Lions
  { match: "Progressive Field", lat: 41.4962, lng: -81.6852 }, // Guardians
  { match: "Rocket Arena", lat: 41.4966, lng: -81.6881 }, // Cavaliers
  { match: "Rocket Mortgage", lat: 41.4966, lng: -81.6881 },
  { match: "Wrigley Field", lat: 41.9484, lng: -87.6553 }, // Cubs
  { match: "Kaseya Center", lat: 25.7814, lng: -80.187 }, // Heat
  { match: "Sahlen Field", lat: 42.8795, lng: -78.8738 }, // Blue Jays 2021 (Buffalo)
  { match: "Citi Field", lat: 40.7571, lng: -73.8458 }, // Mets
  { match: "Fenway Park", lat: 42.3467, lng: -71.0972 }, // Red Sox
  { match: "KeyBank Center", lat: 42.875, lng: -78.8764 }, // Sabres

  // --- likely future venues (favorite teams' opponents / iconic parks) ---
  { match: "MetLife Stadium", lat: 40.8135, lng: -74.0745 },
  { match: "Gillette Stadium", lat: 42.0909, lng: -71.2643 },
  { match: "M&T Bank Stadium", lat: 39.278, lng: -76.6227 },
  { match: "Acrisure Stadium", lat: 40.4468, lng: -80.0158 },
  { match: "Paycor Stadium", lat: 39.0955, lng: -84.5161 },
  { match: "Lincoln Financial Field", lat: 39.9008, lng: -75.1675 },
  { match: "Lambeau Field", lat: 44.5013, lng: -88.0622 },
  { match: "Arrowhead Stadium", lat: 39.0489, lng: -94.4839 },
  { match: "Lucas Oil Stadium", lat: 39.7601, lng: -86.1639 },
  { match: "Comerica Park", lat: 42.339, lng: -83.0485 },
  { match: "Rate Field", lat: 41.83, lng: -87.6338 },
  { match: "Guaranteed Rate Field", lat: 41.83, lng: -87.6338 },
  { match: "Target Field", lat: 44.9817, lng: -93.2776 },
  { match: "Kauffman Stadium", lat: 39.0517, lng: -94.4803 },
  { match: "Yankee Stadium", lat: 40.8296, lng: -73.9262 },
  { match: "Great American Ball Park", lat: 39.0975, lng: -84.5069 },
  { match: "PNC Park", lat: 40.4469, lng: -80.0057 },
  { match: "Oriole Park", lat: 39.2839, lng: -76.6217 },
  { match: "Camden Yards", lat: 39.2839, lng: -76.6217 },
  { match: "Dodger Stadium", lat: 34.0739, lng: -118.24 },
  { match: "American Family Field", lat: 43.028, lng: -87.9712 },
  { match: "Madison Square Garden", lat: 40.7505, lng: -73.9934 },
  { match: "TD Garden", lat: 42.3662, lng: -71.0621 },
  { match: "Little Caesars Arena", lat: 42.3411, lng: -83.0553 },
  { match: "United Center", lat: 41.8807, lng: -87.6742 },
  { match: "Scotiabank Arena", lat: 43.6435, lng: -79.3791 },
  { match: "PPG Paints Arena", lat: 40.4395, lng: -79.9896 },
];

/** Look up coordinates for a venue by (substring) name. Null if not curated yet. */
export function lookupVenueCoords(name: string | null | undefined): { lat: number; lng: number } | null {
  if (!name) return null;
  const hit = COORDS.find((c) => name.includes(c.match));
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}
