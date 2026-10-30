import type { Metadata } from 'next';
import Link from 'next/link';
import BrandMark from '@/components/layout/BrandMark';
import { cn } from '@/components/ui/cn';
import HeroBackdrop from '@/components/landing/HeroBackdrop';
import RunnerTour from '@/components/landing/RunnerTour';
import SiteNav from '@/components/landing/SiteNav';
import StickyCta from '@/components/landing/StickyCta';
import Warmup from '@/components/landing/Warmup';
import { Var } from '@/components/landing/MathText';
import { countFreeTests } from '@/lib/landing/freeTests';
import { SITE_URL, TELEGRAM_URL } from '@/lib/landing/warmup';
import { BASE_OPEN_GRAPH, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE } from '@/lib/siteMetadata';

/*
 * The public landing, "Hard Mode": a page that tests instead of promising,
 * kept short (the owner's call, 2026-10-30). The hero says in one line what
 * MYSATuz is and offers the free test; beside it, three real SAT-style
 * questions with a clock, no sign-up. The one section below shows the test
 * screen, so test day is not the first time a student sees it.
 *
 * This file stays a server component: the copy is rendered here, and the
 * interactive parts are small client islands in components/landing. Nothing
 * on this page shows a price, a testimonial or a number it cannot back — no
 * score either, until there is one; every demonstration is labelled "Example".
 *
 * The live fact is how many tests are free, read from the database and cached
 * with the page for five minutes.
 */
export const revalidate = 300;

// Under 160 characters, so a search result shows it whole.
const DESCRIPTION =
  'Digital SAT Math practice for students in Uzbekistan: full timed tests, a score estimate on the 200–800 scale, and 3 questions to try without an account.';

export const metadata: Metadata = {
  // absolute: the root layout's template would append " · MYSATuz" again.
  title: { absolute: SITE_TITLE },
  description: DESCRIPTION,
  // Resolves against metadataBase (layout.tsx) to https://www.slope.uz/.
  alternates: { canonical: '/' },
  // The same words in a search result and in a link shared in Telegram.
  openGraph: { ...BASE_OPEN_GRAPH, title: SITE_TITLE, description: DESCRIPTION, url: '/', images: [SITE_OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: SITE_TITLE, description: DESCRIPTION, images: [SITE_OG_IMAGE] },
};

const developers = [
  {
    name: 'Mr Mardon',
    email: 'abdunazarovmardon@gmail.com',
    phone: { href: 'tel:+998915502025', label: '+998 91 550 20 25' },
    telegram: { href: 'https://t.me/Abd_mardon', label: '@Abd_mardon' },
  },
  {
    name: 'Mr Yoqubjon',
    email: 'yoqubjon.isaqjonov@mail.ru',
    phone: { href: 'tel:+998999214595', label: '+998 99 921 45 95' },
    telegram: { href: 'https://t.me/Yokubjon_Isaqjonov', label: '@Yokubjon_Isaqjonov' },
  },
];

const container = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';
// scroll-mt: a section opened from the header lands below the header. The
// band's gray-200 edges, not 100: at 100 they vanished and the hero, the band
// and the footer ran together.
const bandClass = 'scroll-mt-20 border-y border-gray-200 bg-gray-50 py-12 lg:py-16';
// No margins in these two: cn() does not merge, so a caller's own margin
// would fight one baked in. Each use says how far it sits from what is above.
const eyebrowClass = 'text-sm font-medium text-gray-600';
const h2Class = 'text-2xl font-semibold tracking-tight text-balance text-gray-900 lg:text-3xl';
const bodyClass = 'max-w-[60ch] text-base leading-7 text-gray-600 text-pretty';
const footerLinkClass = 'text-gray-600 transition-colors hover:text-gray-900';
// Underlined: grey contact lines with no other sign of a link read as text.
// gray-400, not 300: the underline is the only cue, and 300 is the 1.5:1
// grey AGENTS.md retires for chevrons.
const contactLinkClass =
  'block w-fit underline decoration-gray-400 underline-offset-4 transition-colors hover:text-ink-600 hover:decoration-ink-600';

function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="MYSATuz home">
      <BrandMark size="sm" />
      <span className={cn('font-semibold tracking-tight text-gray-900', small ? 'text-sm' : 'text-base')}>MYSATuz</span>
    </Link>
  );
}

/**
 * Who the site is (the name MYSATuz on the domain slope.uz, so search does not
 * fall back to the bare domain), as schema.org data. `<` is escaped as the
 * Next JSON-LD guide does, so no string can close the script.
 */
function structuredData() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: ['slope.uz'],
        url: `${SITE_URL}/`,
        inLanguage: 'en',
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/brand/mark.png`,
        contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', url: TELEGRAM_URL },
      },
    ],
  }).replace(/</g, '\\u003c');
}

export default async function Home() {
  const freeTests = await countFreeTests();

  return (
    <div className="bg-white text-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData() }} />
      <SiteNav />

      <main>
        {/* 1 · The hero: what this is, the free test, and the warm-up. No
            bottom border: the band below draws that edge. */}
        <section id="warmup" aria-labelledby="warmup-heading" className="relative overflow-hidden">
          <HeroBackdrop />
          <Warmup freeTests={freeTests} />
        </section>

        {/* 2 · The room, on a grey band between the white hero and footer */}
        <section id="test-screen" aria-labelledby="room-heading" className={bandClass}>
          <div className={container}>
            <RunnerTour>
              <p className={eyebrowClass}>The test screen</p>
              <h2 id="room-heading" className={cn(h2Class, 'mt-2')}>
                Test day shouldn’t be the first time you see this screen.
              </h2>
              <p className={cn(bodyClass, 'mt-4')}>Every MYSATuz test runs on a screen built like the real Digital SAT app.</p>
            </RunnerTour>
          </div>
        </section>
      </main>

      {/* No top border: the band above draws that edge. */}
      <footer id="site-footer" className="py-8 text-sm text-gray-600">
        <div className={cn(container, 'flex flex-wrap items-center justify-between gap-4')}>
          <Brand small />
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
              Telegram support
            </a>
            <Link href="/login" className={footerLinkClass}>
              Sign in
            </Link>
            <Link href="/privacy" className={footerLinkClass}>
              Privacy
            </Link>
            <Link href="/terms" className={footerLinkClass}>
              Terms
            </Link>
          </nav>
        </div>

        <div className={cn(container, 'mt-4 grid gap-1')}>
          <p>
            Why slope.uz? <Var>y</Var> = <Var>mx</Var> + <Var>b</Var>. Keep <Var>m</Var> positive.
          </p>
          <p>SAT is a registered trademark of the College Board, which is not affiliated with MYSATuz.</p>
        </div>

        <div className={cn(container, 'mt-8')}>
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900">Project developers</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {developers.map((developer) => (
                <div key={developer.name}>
                  <h4 className="text-sm font-medium text-gray-900">{developer.name}</h4>
                  <div className="mt-2 space-y-1">
                    <a className={contactLinkClass} href={`mailto:${developer.email}`}>
                      {developer.email}
                    </a>
                    <a className={cn(contactLinkClass, 'tabular-nums')} href={developer.phone.href}>
                      {developer.phone.label}
                    </a>
                    <a
                      className={contactLinkClass}
                      href={developer.telegram.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {developer.telegram.label}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <StickyCta freeTests={freeTests} />
    </div>
  );
}
