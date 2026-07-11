/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // ESPN team logos are served from a.espncdn.com
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
};

export default nextConfig;
