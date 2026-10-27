/**
 * The site's name and the Open Graph fields every page shares. A page that
 * sets its own `openGraph` replaces the layout's whole object (Next merges
 * metadata one level deep), so it spreads these back in.
 *
 * The picture is the owner's site-kit card, public/brand/social-card.png. A
 * page that sets its own `openGraph` loses the layout's, so every such page
 * passes SITE_OG_IMAGE again (the landing, Privacy, Terms).
 */
export const SITE_NAME = 'MYSATuz';
export const SITE_TITLE = `${SITE_NAME} · Digital SAT Math practice`;
export const BASE_OPEN_GRAPH = { type: 'website', siteName: SITE_NAME } as const;
/** Resolves against metadataBase to https://www.slope.uz/brand/social-card.png. */
export const SITE_OG_IMAGE = { url: '/brand/social-card.png', width: 1200, height: 630, alt: SITE_TITLE };
