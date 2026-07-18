/**
 * Zubaz banner — a chevron print in a team's two colors, for the profile header.
 *
 * The one deliberately loud surface in the app. It's confined to a band above the
 * neutral header content, so team color reads as identity (whose log is this)
 * without touching the almanac's near-neutral chrome anywhere else.
 *
 * The COLOR PAIR is what does the work: ESPN primaries cluster in navy and black,
 * so primary-alone would render half of all users the same rectangle. Bills
 * blue+red and Packers green+gold are unmistakable.
 *
 * Pure CSS gradients — no image assets, scales to any pair.
 */

function hex(color: string | null | undefined): string | null {
  if (!color) return null;
  const c = color.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(c) ? `#${c}` : null;
}

/** WCAG relative luminance, 0 (black) → 1 (white). */
function luminance(h: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

const BANDS = 8;

export function ZubazBanner({
  primary,
  secondary,
  height = 64,
  className = "",
}: {
  primary: string | null;
  secondary: string | null;
  height?: number;
  className?: string;
}) {
  let c1 = hex(primary);
  let c2 = hex(secondary);
  if (!c1 && !c2) return null;
  if (!c1) [c1, c2] = [c2, null];

  // Keep the darker color as the dominant stripe — otherwise a pale primary
  // (rare, but e.g. silver/white kits) washes out against the white ground.
  if (c1 && c2 && luminance(c1) > luminance(c2)) [c1, c2] = [c2, c1];

  // A near-white accent (Yankees' #c4ced4) would vanish into the white stripes,
  // so drop to a two-tone print rather than render a muddy band.
  if (c2 && luminance(c2) > 0.72) c2 = null;

  const stripes = (angle: number) =>
    c2
      ? `repeating-linear-gradient(${angle}deg, ${c1} 0 7px, #fff 7px 13px, ${c2} 13px 17px, #fff 17px 27px)`
      : `repeating-linear-gradient(${angle}deg, ${c1} 0 8px, #fff 8px 18px)`;

  return (
    // Decorative: the team is already named in the content below.
    <div aria-hidden="true" className={`flex overflow-hidden ${className}`} style={{ height }}>
      {Array.from({ length: BANDS }).map((_, i) => (
        <span key={i} className="flex-1" style={{ backgroundImage: stripes(i % 2 ? -45 : 45) }} />
      ))}
    </div>
  );
}
