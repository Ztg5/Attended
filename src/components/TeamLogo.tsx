import Image from "next/image";

/** ESPN stores primary colors as bare hex ("00338d"). Normalize, reject junk. */
function hex(color: string | null | undefined): string | null {
  if (!color) return null;
  const c = color.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(c) ? `#${c}` : null;
}

/**
 * Real ESPN team logo on a neutral plate so varied logos share a common ground.
 * `dimmed` renders the "unseen" collection state (grayscale + low opacity).
 *
 * `ringColor` draws the team-color keyline around the plate — team color as a
 * data channel (see DESIGN.md). It is an accent only: ESPN primaries cluster
 * hard in navy/black (three teams are literally #000000), so color can never be
 * the identifier here — the logo and name always carry that.
 */
export function TeamLogo({
  url,
  alt,
  size = 28,
  dimmed = false,
  ringColor = null,
}: {
  url: string | null;
  alt: string;
  size?: number;
  dimmed?: boolean;
  ringColor?: string | null;
}) {
  const plate = size + 10;
  const tint = hex(ringColor);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded bg-logo-plate ${
        tint ? "" : "ring-1 ring-border"
      }`}
      style={{
        width: plate,
        height: plate,
        ...(tint ? { boxShadow: `0 0 0 2px ${tint}` } : null),
      }}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          width={size}
          height={size}
          className={dimmed ? "opacity-35 grayscale" : ""}
          style={{ objectFit: "contain", width: size, height: size }}
        />
      ) : (
        <span className="text-[10px] font-medium text-faint">{alt.slice(0, 3)}</span>
      )}
    </span>
  );
}
