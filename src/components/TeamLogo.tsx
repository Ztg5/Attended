import Image from "next/image";

/**
 * Real ESPN team logo on a neutral plate so varied logos share a common ground.
 * `dimmed` renders the "unseen" collection state (grayscale + low opacity).
 */
export function TeamLogo({
  url,
  alt,
  size = 28,
  dimmed = false,
}: {
  url: string | null;
  alt: string;
  size?: number;
  dimmed?: boolean;
}) {
  const plate = size + 10;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded bg-logo-plate ring-1 ring-border"
      style={{ width: plate, height: plate }}
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
