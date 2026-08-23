import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // webtorrent must stay external so its optional native deps aren't bundled
  serverExternalPackages: ["webtorrent"],
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
