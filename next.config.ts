import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.18.198.206"],
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    proxyClientMaxBodySize: "25mb",
    // Next 15 changed the dynamic client-cache default to 0, so every return to
    // an already-visited section refetched from the server. That is expensive
    // here: functions run in iad1 while users are in Central Asia, so each
    // navigation pays a transcontinental round trip before any work starts.
    // Caching a segment for 30 s makes moving back and forth through the
    // sidebar instant. Admin mutations call refresh(), which busts this cache,
    // so a stale list cannot survive an edit.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
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
