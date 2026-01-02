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
};

export default nextConfig;
