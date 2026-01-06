import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize steam-user and its dependencies to avoid bundling issues
  // steam-crypto needs to access system.pem file at runtime
  serverExternalPackages: ["steam-user", "@doctormckay/steam-crypto"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shared.akamai.steamstatic.com",
        pathname: "/store_item_assets/**",
      },
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/steam/apps/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/find/:id",
        destination: "/games/:id",
        permanent: true,
      },
      // Legacy format: /:id/:slug -> /games/:id
      // Matches patterns like /57/proteus, /117/i-am-your-beast
      {
        source: "/:id(\\d+)/:slug",
        destination: "/games/:id",
        permanent: true,
      },
      // User profiles (legacy) -> home
      {
        source: "/user/:username",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
