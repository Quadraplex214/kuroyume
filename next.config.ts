import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
