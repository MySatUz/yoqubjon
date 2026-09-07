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
    // 31 days. The default is 4 hours, which was throwing the optimizer's work
    // away before it could pay for itself: 2.1k transformations a month against
    // 268 stored images, roughly eight rebuilds of each, while cache writes
    // (2.7k) outnumbered cache reads (1.2k).
    //
    // A month is safe here because a question image is immutable. Its path
    // carries the test's id, nothing is written over it, and deleting a test now
    // deletes its folder. The upstream `Cache-Control` cannot help — Supabase
    // serves these objects as `no-cache` — so this value alone decides the TTL.
    //
    // The cost is that Next has no way to invalidate the image cache. Re-uploading
    // a test under the SAME id with the same file names would keep serving the old
    // picture for up to a month; a normal re-upload mints a new id, and so a new
    // path.
    minimumCacheTTL: 2678400,
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
