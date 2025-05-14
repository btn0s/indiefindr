import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/games/:id/:name",
        destination: "/:id/:name",
        permanent: true,
      },
      {
        source: "/user/:username",
        destination: "/:username",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.akamai.steamstatic.com",
        port: "",
        pathname: "/steam/apps/**",
      },
      {
        protocol: "https",
        hostname: "*.akamai.steamstatic.com",
        port: "",
        pathname: "/store_item_assets/**",
      },
    ],
  },
};

export default nextConfig;
