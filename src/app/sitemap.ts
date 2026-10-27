import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/landing/warmup';

/** The public pages worth finding in search. Sign-in forms are reachable but not listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
