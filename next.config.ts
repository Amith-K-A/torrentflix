import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // webtorrent must stay external so its optional native deps aren't bundled
  serverExternalPackages: ["webtorrent"],
  env: {
    TMDB_API_KEY: process.env.TMDB_API_KEY || "3abea6c0bb2e0cd1800d028f0b96b8b4",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
};

export default nextConfig;
