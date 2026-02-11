import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images (QR code API)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
};

export default nextConfig;
