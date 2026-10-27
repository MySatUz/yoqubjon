import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import { buttonClass, linkClass } from '@/components/ui/Button';
import { cardClass, insetClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { List, listRowInteractiveClass, rowChevronClass } from '@/components/ui/List';
import HardBranch from '@/components/landing/HardBranch';
import HeroBackdrop from '@/components/landing/HeroBackdrop';
import OlympiadDate from '@/components/landing/OlympiadDate';
import OlympiadRanking from '@/components/landing/OlympiadRanking';
import Reveal from '@/components/landing/Reveal';
import ReviewEcho from '@/components/landing/ReviewEcho';
import RunnerTour from '@/components/landing/RunnerTour';
import SiteNav from '@/components/landing/SiteNav';
import SlopeToGoal from '@/components/landing/SlopeToGoal';
import StickyCta from '@/components/landing/StickyCta';
import Warmup from '@/components/landing/Warmup';
import { WarmupEchoLine } from '@/components/landing/WarmupEcho';
import { Var } from '@/components/landing/MathText';
import { countFreeTests } from '@/lib/landing/freeTests';
import { getLandingSchedule } from '@/lib/landing/nextOlympiad';
import { FREE_OFFER_CTA, SITE_URL, TELEGRAM_HANDLE, TELEGRAM_URL } from '@/lib/landing/warmup';
import { FREE_PLAN, PREMIUM_PLAN, type PlanSummary } from '@/lib/plans';
import { MIN_QUESTIONS_FOR_SCORE } from '@/lib/scoreDisplay';
import { BASE_OPEN_GRAPH, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE } from '@/lib/siteMetadata';
import { getSubscriptionSettings } from '@/lib/subscription-settings';

/*
 * The public landing, "Hard Mode": a page that tests instead of promising.
 * The hero says in one line what MYSATuz is and offers the free test; beside
 * it, three real SAT-style questions with a clock, no sign-up. Every section
 * below answers one fear — being wrong, a hard Module 2, an unfamiliar test
 * screen, what olympiads are, what a parent pays for — and each echoes the
 * student's own warm-up where it can.
 *
 * This file stays a server component: the copy is rendered here, and the
 * interactive parts are small client islands in components/landing. Nothing
 * on this page shows a price, a testimonial or a number it cannot back — no
 * score either, until there is one; every demonstration is labelled "Example".
 * The plans come from lib/plans.ts, the same list the app's subscription
 * page shows.
 *
 * The live facts are the next olympiad, whether Premium is on sale and how
 * many tests are free, read from the database and cached with the page for
 * five minutes.
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

const week = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const groupDays = new Set(['Tu', 'Th']);

const container = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';
// scroll-mt: a section opened from the header lands below its floating pill.
const sectionClass = 'scroll-mt-20 py-16 lg:py-20';
// gray-200, not 100: at 100 the band edges vanished and the sections ran together.
const altSectionClass = cn(sectionClass, 'border-y border-gray-200 bg-gray-50');
// No margins in these two: cn() does not merge, so a caller's own margin
// would fight one baked in. Each use says how far it sits from what is above.
const eyebrowClass = 'text-sm font-medium text-gray-600';
const h2Class = 'text-2xl font-semibold tracking-tight text-balance text-gray-900 lg:text-4xl';
const bodyClass = 'max-w-[60ch] text-base leading-7 text-gray-600 text-pretty';
// gray-600: the notes also sit on the gray-50 bands.
const noteClass = 'mt-3 text-sm text-gray-600';
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

/** A plan card for the parents' section; the copy is lib/plans.ts, shared with the app. */
function PlanCard({
  plan,
  featured = false,
  children,
}: {
  plan: PlanSummary;
  featured?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl bg-white p-5',
        // The one highlighted card: a board edge, the same as on the app's plans.
        featured ? 'border border-ink-600 ring-1 ring-ink-600' : 'border border-gray-200',
      )}
    >
      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-gray-600">{plan.summary}</p>
      <ul className="mb-6 mt-4 grid gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm leading-6 text-gray-700">
            <Check className="mt-1 h-4 w-4 shrink-0 text-ink-600" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

type Faq = { question: string; answer: string; link?: { href: string; label: string } };

/**
 * What students and parents ask, answered only with what the code does: the
 * plans from plans.ts, the score rule from scoreDisplay.ts. The same list is
 * the FAQPage data below, so a search result says what the page says. No
 * price, and no promise of explanations (the owner's rules).
 */
function buildFaqs(salesOpen: boolean): Faq[] {
  return [
    {
      question: 'Is it only Math?',
      answer: 'Yes. MYSATuz covers the Math section of the Digital SAT only: no reading and no writing.',
    },
    {
      question: 'What can I do for free?',
      answer:
        'Create an account and take the tests marked Free in Practice, on the same timed test screen. Every finished test gets a review of every question. No payment details are needed.',
    },
    {
      question: 'Is the score official?',
      answer: `No. It is an estimate on the 200–800 scale, given for a test of ${MIN_QUESTIONS_FOR_SCORE} questions or more. Only the College Board gives official SAT scores.`,
    },
    {
      question: 'Do the modules adapt like the real test?',
      answer:
        'No. On the real Digital SAT, how you do on Module 1 decides which Module 2 you get. Our modules are fixed sets: your answers never change the questions that follow.',
    },
    {
      question: 'Can I see my mistakes after a test?',
      answer:
        'Yes. Every finished test shows your answer next to the correct one, one question at a time. For an olympiad, the review opens when it closes. Every attempt is saved, so you can open an old one again.',
    },
    {
      question: 'How many times can I take a test?',
      answer: 'Each test has its own number of attempts, and its card in Practice shows how many you have left.',
    },
    {
      question: `What does ${PREMIUM_PLAN.name} add?`,
      // While sales are paused nothing can be bought, so the answer says what Premium will be.
      answer: salesOpen
        ? 'Every test in every Practice course, with 30 days of access for each payment. You pay inside your account, and nothing is ever charged automatically.'
        : `New Premium subscriptions are paused for now. When they reopen, ${PREMIUM_PLAN.name} opens every test in every Practice course, with 30 days of access for each payment, paid inside your account and never charged automatically.`,
    },
    {
      question: 'How do olympiads work?',
      answer:
        'An olympiad opens and closes at set times, shown in Tashkent time. Your best attempt inside that window counts. When it closes, the ranking appears: most questions solved first, then the shorter time.',
    },
    {
      question: 'Where can I ask a question?',
      answer: `Write to us in Telegram, ${TELEGRAM_HANDLE}.`,
      link: { href: TELEGRAM_URL, label: TELEGRAM_HANDLE },
    },
  ];
}

/** An answer, with its link (if any) made clickable where its label appears in the text. */
function FaqAnswer({ faq }: { faq: Faq }) {
  if (!faq.link) return faq.answer;
  const [before, after = ''] = faq.answer.split(faq.link.label);
  return (
    <>
      {before}
      <a href={faq.link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {faq.link.label}
      </a>
      {after}
    </>
  );
}

/**
 * Who the site is (the name MYSATuz on the domain slope.uz, so search does not
 * fall back to the bare domain) and the FAQ, as schema.org data. `<` is
 * escaped as the Next JSON-LD guide does, so no string can close the script.
 */
function structuredData(faqs: Faq[]) {
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
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  }).replace(/</g, '\\u003c');
}

/** Whether Premium is on sale. A failed read keeps the usual button: the app's own page says if it is closed. */
async function readSalesOpen() {
  try {
    return (await getSubscriptionSettings()).isEnabled;
  } catch (error) {
    console.error('Landing: could not read the subscription settings', error);
    return true;
  }
}

export default async function Home() {
  const [schedule, salesOpen, freeTests] = await Promise.all([
    getLandingSchedule(),
    readSalesOpen(),
    countFreeTests(),
  ]);
  const faqs = buildFaqs(salesOpen);

  return (
    <div className="bg-white text-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData(faqs) }} />
      <SiteNav />

      <main>
        {/* 1 · The hero: what this is, the free test, and the warm-up. No
            bottom border: the next band draws its own top edge. */}
        <section id="warmup" aria-labelledby="warmup-heading" className="relative overflow-hidden">
          <HeroBackdrop />
          <Warmup freeTests={freeTests} />
        </section>

        {/* 2 · Review */}
        <section id="review" aria-labelledby="review-heading" className={altSectionClass}>
          <div className={container}>
            <p className={eyebrowClass}>After every test</p>
            <h2 id="review-heading" className={cn(h2Class, 'mt-2')}>
              Be wrong here. Not on test day.
            </h2>
            <p className={cn(bodyClass, 'mt-4')}>
              After every test you see how many you got right, your time, and every question with your answer next to
              the correct one. A full test also gets a score estimate on the 200–800 scale. Every attempt is saved, so
              you can open an old one and see exactly what tripped you.
            </p>
            <p className={noteClass}>Practice results aren’t ranked against anyone. Only olympiads have a ranking.</p>
            <ReviewEcho />
          </div>
        </section>

        {/* 3 · The hard branch */}
        <section id="module-2" aria-labelledby="branch-heading" className={sectionClass}>
          <div className={container}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <p className={eyebrowClass}>How the real test works</p>
                <h2 id="branch-heading" className={cn(h2Class, 'mt-2')}>
                  If Module 2 feels hard, you did Module 1 right.
                </h2>
                <p className={cn(bodyClass, 'mt-4')}>
                  On the real Digital SAT, Math comes in two modules. How you do on the first decides which second
                  module you get. A strong Module 1 sends you to the harder Module 2, and the top of the scale is only
                  within reach from there. So a hard Module 2 isn’t bad news. It’s the sign you’re on the right road.
                </p>
                <p className={noteClass}>
                  Our modules don’t route you. They’re fixed sets, so you can train on the hard branch on purpose.
                </p>
              </div>
              <HardBranch />
            </div>

          </div>
        </section>

        {/* 4 · The room */}
        <section id="test-screen" aria-labelledby="room-heading" className={altSectionClass}>
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

        {/* 5 · Olympiads and groups */}
        <section id="olympiads" aria-labelledby="olympiad-heading" className={sectionClass}>
          <div className={container}>
            {/* The heading is about the rule, so the label says what the section is. */}
            <p className={eyebrowClass}>Olympiads and groups</p>
            <h2 id="olympiad-heading" className={cn(h2Class, 'mt-2')}>
              One window. Your best attempt counts.
            </h2>
            <p className={cn(bodyClass, 'mt-4')}>
              Olympiads open on a set date and close on schedule, Tashkent time. Your best attempt inside the window is
              the one that counts. When the window closes, the ranking appears: most questions solved first, then the
              shorter time.
            </p>
            <OlympiadDate olympiad={schedule.olympiad} checkedAt={schedule.checkedAt} />

            <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[7fr_5fr]">
              <OlympiadRanking />
              <Reveal className={cn(cardClass, 'p-5')}>
                <h3 className="text-base font-semibold text-gray-900">Prefer a schedule?</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Groups train together on fixed days, for example an evening group on Tuesdays and Thursdays at 18:00,
                  with courses opened for the group.{' '}
                  <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    Ask about groups in Telegram
                  </a>
                  .
                </p>
                <ul className="mt-4 grid grid-cols-7 gap-1.5" aria-label="Example week">
                  {week.map((day, index) => {
                    const on = groupDays.has(day);
                    return (
                      <li
                        key={day}
                        className={cn(
                          'rounded-xl border py-2 text-center text-xs',
                          on ? 'border-ink-600 bg-ink-50 font-medium text-ink-700' : 'border-gray-200 text-gray-600',
                        )}
                      >
                        {day}
                        {on && (
                          <>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'mx-auto mb-0.5 mt-1.5 block h-2 w-2 scale-0 rounded-full bg-ink-600 transition-transform duration-180',
                                'ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[inview]:scale-100 motion-reduce:scale-100 motion-reduce:transition-none',
                                index > 1 && 'delay-80',
                              )}
                            />
                            <span className="block tabular-nums">18:00</span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 6 · For parents — the one place money comes up, and never a price */}
        <section id="parents" aria-labelledby="parents-heading" className={altSectionClass}>
          <div className={container}>
            <p className={eyebrowClass}>For parents</p>
            <h2 id="parents-heading" className={cn(h2Class, 'mt-2')}>
              Start free. Pay only if it’s worth it.
            </h2>
            <p className={cn(bodyClass, 'mt-4')}>
              {salesOpen ? '2 plans, and what each one opens. Paying happens inside your account.' : '2 plans, and what each one opens.'}
            </p>

            <div id="parents-plans" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <PlanCard plan={FREE_PLAN}>
                <Link
                  href="/register?from=pricing"
                  className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}
                >
                  {FREE_OFFER_CTA}
                </Link>
              </PlanCard>
              <PlanCard plan={PREMIUM_PLAN} featured={salesOpen}>
                {salesOpen ? (
                  <>
                    <Link href="/register?from=premium" className={buttonClass({ size: 'lg', block: true })}>
                      Go Premium
                    </Link>
                    <p className="mt-2 text-center text-sm text-gray-600">
                      You upgrade inside your account after signing up.
                    </p>
                  </>
                ) : (
                  // Sales are paused (SubscriptionAvailabilityControl): no
                  // button that would end on a page with nothing to buy.
                  <p className={cn(insetClass, 'px-4 py-3 text-sm text-gray-600')}>
                    New Premium subscriptions are paused for now. The free tests stay open.{' '}
                    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      Ask in Telegram
                    </a>{' '}
                    when Premium reopens.
                  </p>
                )}
              </PlanCard>
            </div>

          </div>
        </section>

        {/* 7 · Questions: the objections in one place, collapsed so the list stays short */}
        <section id="faq" aria-labelledby="faq-heading" className={sectionClass}>
          <div className={cn(container, 'grid grid-cols-1 gap-8 lg:grid-cols-[2fr_3fr] lg:gap-16')}>
            <div>
              <p className={eyebrowClass}>FAQ</p>
              <h2 id="faq-heading" className={cn(h2Class, 'mt-2')}>
                Before you start
              </h2>
              <p className={cn(bodyClass, 'mt-4')}>Short answers about the tests, the score and the plans.</p>
            </div>
            <List>
              {faqs.map((faq) => (
                <li key={faq.question}>
                  <details className="group">
                    <summary
                      className={cn(
                        listRowInteractiveClass,
                        'cursor-pointer list-none justify-between text-sm font-medium text-gray-900 [&::-webkit-details-marker]:hidden',
                      )}
                    >
                      {faq.question}
                      <ChevronDown className={cn(rowChevronClass, 'group-open:rotate-180')} aria-hidden="true" />
                    </summary>
                    <p className="px-4 pb-4 text-sm text-gray-600 sm:px-5">
                      <FaqAnswer faq={faq} />
                    </p>
                  </details>
                </li>
              ))}
            </List>
          </div>
        </section>

        {/* 8 · Closing */}
        <section id="closing" aria-labelledby="closing-heading" className={cn(altSectionClass, 'text-center')}>
          <div className={container}>
            {/* The slope itself, drawn up to 800 once it is seen — not an empty
                score: nothing on this page shows one before there is one. */}
            <SlopeToGoal animate className="mx-auto w-40" />
            <h2 id="closing-heading" className={cn(h2Class, 'mt-4')}>
              800 isn’t a jump. It’s a slope.
            </h2>
            <p className={cn(bodyClass, 'mx-auto mt-4')}>
              Every line starts somewhere. A free test finds your starting point, with every question reviewed and a
              score estimate on the 200–800 scale for a full test. Then it’s one test at a time.
            </p>
            <WarmupEchoLine className="mx-auto mt-3 max-w-[60ch]" />
            <div className="mt-8">
              <Link href="/register?from=final" className={buttonClass({ size: 'lg' })}>
                {FREE_OFFER_CTA}
              </Link>
            </div>
            <p className={noteClass}>
              Already have an account?{' '}
              <Link href="/login" className={linkClass}>
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* No top border: the closing band above draws that edge. */}
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
            <a href="#parents" className={footerLinkClass}>
              For parents
            </a>
            <a href="#faq" className={footerLinkClass}>
              FAQ
            </a>
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
