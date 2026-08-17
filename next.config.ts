import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.18.198.206"],
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    proxyClientMaxBodySize: "25mb",
  },
  images: {
    // Single format on purpose. The optimizer picks the FIRST entry the
    // browser's `Accept` header matches, so the previous
    // ["image/webp", "image/avif"] never produced a single AVIF response —
    // every AVIF-capable browser also accepts WebP. Rather than flip the
    // order, we keep WebP only: it is Next's default and recommendation, it
    // avoids AVIF's ~50 % longer first-request encode on user-uploaded
    // question images (requested mid-exam), and it keeps one cache variant
    // per image instead of two.
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
