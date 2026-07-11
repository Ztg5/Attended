import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopo from "us-atlas/states-10m.json";
import type { VenueVisit } from "@/lib/collection";

const W = 960;
const H = 600;

/** US map with a pin per venue visited, sized by games attended, colored by home team. */
export function StadiumMap({ venues }: { venues: VenueVisit[] }) {
  const topo = statesTopo as any;
  const states = feature(topo, topo.objects.states) as any;

  const projection = geoAlbersUsa().fitSize([W, H], states);
  const path = geoPath(projection);

  const pins = venues
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => {
      const xy = projection([v.lng as number, v.lat as number]);
      return xy ? { v, x: xy[0], y: xy[1], r: 6 + Math.sqrt(v.games) * 2.4 } : null;
    })
    .filter((p): p is { v: VenueVisit; x: number; y: number; r: number } => p !== null)
    // larger first so smaller pins in a cluster (e.g. Cleveland) sit on top
    .sort((a, b) => b.r - a.r);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of stadiums visited">
      <g>
        {states.features.map((f: any, i: number) => (
          <path
            key={i}
            d={path(f) ?? undefined}
            fill="var(--surface-2)"
            stroke="var(--border)"
            strokeWidth={0.75}
          />
        ))}
      </g>
      <g>
        {pins.map(({ v, x, y, r }) => (
          <g key={v.id}>
            <title>{`${v.name} — ${v.games} game${v.games === 1 ? "" : "s"} (${v.city ?? ""})`}</title>
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={v.teamColor ? `#${v.teamColor}` : "var(--primary)"}
              fillOpacity={0.85}
              stroke="var(--bg)"
              strokeWidth={2}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
