import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize steam-user and its dependencies to avoid bundling issues
  // steam-crypto needs to access system.pem file at runtime
  serverExternalPackages: ["steam-user", "@doctormckay/steam-crypto"],
  // Game page heroes (trailer posters and screenshots, 1920px at Steam) go through the image optimizer, so a phone gets
  // a sharp ~1200px file at a fraction of the bytes. Store headers are already right-sized; those images opt out
  // with `unoptimized` where they render (GameCard, search rows, home showcase).
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.akamai.steamstatic.com", pathname: "/**" }],
  },
  // Cached data, prerendered shells, and the router keeps recent routes mounted (hidden) so back and forward restore
  // a page as it was left, Browse all's loaded pages and scroll included. Links prefetch one shared App Shell per
  // route; a link asks for the full page only when the visitor is about to open it (src/lib/intent.ts).
  cacheComponents: true,
  partialPrefetching: true,
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
