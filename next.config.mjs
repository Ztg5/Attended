/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Every image is an already-optimized ESPN CDN asset (logos, headshots), so we
    // skip Vercel's Image Optimization entirely — the browser loads them straight from
    // a.espncdn.com. This keeps Vercel "Image Optimization - Transformations" at zero.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
};

export default nextConfig;
