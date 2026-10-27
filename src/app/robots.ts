import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/landing/warmup';

/**
 * Crawlers may read the public pages: the landing, the legal pages and the
 * sign-in forms. Everything behind a sign-in stays out. The password-reset and
 * email-confirmation pages say noindex in their own metadata instead of being
 * listed here, since a crawler that may not fetch a page never sees its
 * noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/exam', '/olympiad', '/payment', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
