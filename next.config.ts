import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.18.198.206"],
  images: {
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
