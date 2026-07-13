import Image from "next/image";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Circular player headshot from ESPN, with an initials fallback when absent. */
export function PlayerHeadshot({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt={name} width={size} height={size} className="h-full w-full object-cover object-top" />
      ) : (
        <span className="text-xs font-semibold text-faint">{initials(name)}</span>
      )}
    </span>
  );
}
