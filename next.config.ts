import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Add redirects for deprecated routes
  redirects: async () => {
    return [
      // Redirect old game routes to new format
      {
        source: '/games/:id/:name',
        destination: '/:id/:name',
        permanent: true,
      },
      // Redirect old user profile routes to new format
      {
        source: '/user/:username',
        destination: '/:username',
        permanent: true,
      },
      // Redirect old feed route to new root route
      {
        source: '/feed',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
