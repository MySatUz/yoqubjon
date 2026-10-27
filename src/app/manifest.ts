import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/siteMetadata';

// The home-screen install: the owner's site kit icons (public/icons/), on the
// app's canvas grey (gray-100).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: 'Digital SAT Math practice for students in Uzbekistan.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f1f3f6',
    theme_color: '#f1f3f6',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
