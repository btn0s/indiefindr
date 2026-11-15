import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["steam-user", "@doctormckay/steam-crypto"],
  images: {
    formats: ["image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.akamai.steamstatic.com", pathname: "/**" }],
  },
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      {
        source: "/find/:id",
        destination: "/games/:id",
        permanent: true,
      },
      {
        source: "/:id(\\d+)/:slug",
        destination: "/games/:id",
        permanent: true,
      },
      {
        source: "/user/:username",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
