import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize steam-user and its dependencies to avoid bundling issues
  // steam-crypto needs to access system.pem file at runtime
  serverExternalPackages: ["steam-user", "@doctormckay/steam-crypto"],
  // steam-user loads lzma by a computed name (helpers.requireWithFallback), which the file tracer can't follow: without
  // this, every request-time render of a page that looks up a logo fails on Vercel with "Cannot find module 'lzma'".
  outputFileTracingIncludes: { "/*": ["node_modules/.pnpm/steam-user@*/node_modules/lzma/**/*"] },
  // Box art (600x900), library heroes (3840px) and the media row's stills go through the image optimizer, so a phone
  // gets a sharp file sized to where it draws at a fraction of the bytes. Store headers are already right-sized; those
  // images opt out with `unoptimized` where they render (cover stand-ins, search rows). WebP only: AVIF encodes far
  // slower on a cache miss, and every deploy starts cold.
  images: {
    formats: ["image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.akamai.steamstatic.com", pathname: "/**" }],
  },
  // Cached data, prerendered shells, and the router keeps recent routes mounted (hidden) so back and forward restore
  // a page as it was left, Browse all's loaded pages and scroll included. Game pages are prerendered and cheap, so every
  // card on screen asks for its whole page with prefetch={true} and a tap navigates with no network wait (CardLink).
  // Other links prefetch the route's static shell.
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
