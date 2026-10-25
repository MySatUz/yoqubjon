import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import { buttonClass, linkClass } from '@/components/ui/Button';
import { cardClass, insetClass } from '@/components/ui/Card';
import { badgeClass } from '@/components/ui/Badge';
import { List, listRowClass } from '@/components/ui/List';
import { cn } from '@/components/ui/cn';
import HardBranch from '@/components/landing/HardBranch';
import HeroBackdrop from '@/components/landing/HeroBackdrop';
import OlympiadDate from '@/components/landing/OlympiadDate';
import OlympiadRanking from '@/components/landing/OlympiadRanking';
import ParentShare from '@/components/landing/ParentShare';
import Reveal from '@/components/landing/Reveal';
import ReviewEcho from '@/components/landing/ReviewEcho';
import RunnerTour from '@/components/landing/RunnerTour';
import SlopeToGoal from '@/components/landing/SlopeToGoal';
import StickyCta from '@/components/landing/StickyCta';
import Warmup from '@/components/landing/Warmup';
import { WarmupEchoLine } from '@/components/landing/WarmupEcho';
import { Var } from '@/components/landing/MathText';
import { getLandingSchedule } from '@/lib/landing/nextOlympiad';
import { TELEGRAM_URL } from '@/lib/landing/warmup';
import { FREE_PLAN, PREMIUM_PLAN, type PlanSummary } from '@/lib/plans';
import { getSubscriptionSettings } from '@/lib/subscription-settings';

/*
 * The public landing, "Hard Mode": a page that tests instead of promising.
 * The hero says in one line what MYSATuz is and offers the free module; beside
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
 * The live facts are the next olympiad and whether Premium is on sale, read
 * from the database and cached with the page for five minutes.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  // absolute: the root layout's template would append " · MYSATuz" again.
  title: { absolute: 'MYSATuz · Digital SAT Math practice' },
  description:
    'Digital SAT Math practice that feels like test day: full timed modules, a score estimate on the 200–800 scale and a review of every question. Try three questions first, no sign-up.',
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

const steps = [
  { title: 'Standard tests', body: 'Full timed Math modules. Find your baseline.' },
  { title: 'Advanced set', body: 'For when the standard questions stop feeling hard.' },
  {
    title: 'Hard 800-type',
    body: 'The questions that decide the top of the scale. The calculator helps. Thinking helps more.',
  },
];

const questionTypes = ['Multiple choice', 'Student-produced response', 'Multi-select'];

const paySteps = [
  `Choose ${PREMIUM_PLAN.name} in your account.`,
  'Transfer to the card and amount shown there.',
  'Upload a photo of the receipt.',
  'We check it and switch Premium on.',
];

const week = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const groupDays = new Set(['Tu', 'Th']);

const container = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';
const sectionClass = 'py-16 lg:py-20';
// mist-200, not 100: at 100 the band edges vanished and the sections ran together.
const altSectionClass = cn(sectionClass, 'border-y border-mist-200 bg-mist-50');
// No margins in these two: cn() does not merge, so a caller's own margin
// would fight one baked in. Each use says how far it sits from what is above.
const eyebrowClass = 'text-sm font-medium text-mist-600';
const h2Class = 'text-2xl font-semibold tracking-tight text-balance text-mist-900 lg:text-4xl';
const bodyClass = 'max-w-[60ch] text-base leading-7 text-mist-600 text-pretty';
// mist-600: the notes also sit on the mist-50 bands.
const noteClass = 'mt-3 text-sm text-mist-600';
const footerLinkClass = 'text-mist-600 transition-colors hover:text-mist-900';
// Underlined: grey contact lines with no other sign of a link read as text.
// mist-400, not 300: the underline is the only cue, and 300 is the 1.5:1
// grey AGENTS.md retires for chevrons.
const contactLinkClass =
  'block w-fit underline decoration-mist-400 underline-offset-4 transition-colors hover:text-board-600 hover:decoration-board-600';

function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="MYSATuz home">
      <BrandMark size="sm" />
      <span className={cn('font-semibold tracking-tight text-mist-900', small ? 'text-sm' : 'text-base')}>MYSATuz</span>
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
        featured ? 'border border-board-600 ring-1 ring-board-600' : 'border border-mist-200',
      )}
    >
      <h3 className="text-lg font-semibold text-mist-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-mist-600">{plan.summary}</p>
      <ul className="mb-6 mt-4 grid gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm leading-6 text-mist-700">
            <Check className="mt-1 h-4 w-4 shrink-0 text-board-600" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-auto">{children}</div>
    </div>
  );
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
  const [schedule, salesOpen] = await Promise.all([getLandingSchedule(), readSalesOpen()]);

  return (
    <div className="bg-white text-mist-900">
      {/* Not sticky: on a phone the hero and the warm-up card need every
          pixel of the first screen. */}
      <header className={cn(container, 'flex h-14 items-center justify-between')}>
        <Brand />
        <nav className="flex items-center gap-2" aria-label="Account">
          {/* Outlined, not ghost: beside the primary it has to look like a
              button too, not like a line of grey text. */}
          <Link href="/login" className={buttonClass({ variant: 'secondary' })}>
            Sign in
          </Link>
          <Link href="/register?from=nav" className={buttonClass()}>
            Start free
          </Link>
        </nav>
      </header>

      <main>
        {/* 1 · The hero: what this is, the free module, and the warm-up. No
            bottom border: the next band draws its own top edge. */}
        <section id="warmup" aria-labelledby="warmup-heading" className="relative overflow-hidden">
          <HeroBackdrop />
          <Warmup />
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
        <section aria-labelledby="branch-heading" className={sectionClass}>
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

            <h3 className="mt-16 text-xl font-semibold text-mist-900">Only Math. Built for 750–800.</h3>
            <p className={cn(bodyClass, 'mt-2')}>
              No reading, no writing, no filler. Just the Math section, from your baseline to the questions that decide
              an 800.
            </p>
            {/* A staircase on desktop: each step sits 24 px above the last.
                One height for all three, so the tops climb as evenly as the
                bottoms — with their own heights the stair looked uneven. */}
            <ol className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-end">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className={cn(cardClass, 'p-5 lg:min-h-40', index === 1 && 'lg:mb-6', index === 2 && 'lg:mb-12')}
                >
                  <span className="mb-3 block h-2.5 w-2.5 rounded-full bg-board-600" aria-hidden="true" />
                  <h4 className="text-base font-semibold text-mist-900">{step.title}</h4>
                  <p className="mt-1 text-sm leading-6 text-mist-600">{step.body}</p>
                </li>
              ))}
            </ol>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Question types">
              {questionTypes.map((type) => (
                <li key={type} className={badgeClass()}>
                  {type}
                </li>
              ))}
            </ul>
            <p className={noteClass}>Start with the free tests. {PREMIUM_PLAN.name} opens every course.</p>
          </div>
        </section>

        {/* 4 · The room */}
        <section aria-labelledby="room-heading" className={altSectionClass}>
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
        <section aria-labelledby="olympiad-heading" className={sectionClass}>
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
                <h3 className="text-base font-semibold text-mist-900">Prefer a schedule?</h3>
                <p className="mt-1 text-sm leading-6 text-mist-600">
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
                          on ? 'border-board-600 bg-board-50 font-medium text-board-700' : 'border-mist-200 text-mist-600',
                        )}
                      >
                        {day}
                        {on && (
                          <>
                            <span
                              aria-hidden="true"
                              className={cn(
                                'mx-auto mb-0.5 mt-1.5 block h-2 w-2 scale-0 rounded-full bg-board-600 transition-transform duration-180',
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
            <p className={cn(bodyClass, 'mt-4')}>How access works, how payment works, and who answers questions.</p>

            <div id="parents-plans" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <PlanCard plan={FREE_PLAN}>
                <Link
                  href="/register?from=pricing"
                  className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}
                >
                  Start free
                </Link>
              </PlanCard>
              <PlanCard plan={PREMIUM_PLAN} featured={salesOpen}>
                {salesOpen ? (
                  <>
                    <Link href="/register?from=premium" className={buttonClass({ size: 'lg', block: true })}>
                      Go Premium
                    </Link>
                    <p className="mt-2 text-center text-sm text-mist-600">
                      You upgrade inside your account after signing up.
                    </p>
                  </>
                ) : (
                  // Sales are paused (SubscriptionAvailabilityControl): no
                  // button that would end on a page with nothing to buy.
                  <p className={cn(insetClass, 'px-4 py-3 text-sm text-mist-600')}>
                    New Premium subscriptions are paused for now. The free tests stay open.{' '}
                    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      Ask in Telegram
                    </a>{' '}
                    when Premium reopens.
                  </p>
                )}
              </PlanCard>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
              <div>
                <h3 className="text-xl font-semibold text-mist-900">How paying works</h3>
                {/* The steps stay for when Premium reopens; this line keeps them
                    from reading as an offer while it is paused. */}
                {!salesOpen && (
                  <p className={noteClass}>New Premium subscriptions are paused. This is how paying works when they reopen.</p>
                )}
                {/* One list, not four cards: the steps are rows of one thing. */}
                <List className="mt-3">
                  {paySteps.map((step, index) => (
                    <li key={step} className={cn(listRowClass, 'text-sm text-mist-700')}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-board-50 text-sm font-semibold tabular-nums text-board-700">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </List>
                <div className="mt-4 grid gap-2 text-sm leading-6 text-mist-600">
                  <p>
                    There’s no card form on this site, so nothing is ever charged automatically. You transfer each month
                    yourself and upload the receipt.
                  </p>
                  <p>
                    Questions first?{' '}
                    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      Message us in Telegram
                    </a>
                    .
                  </p>
                </div>
              </div>
              <ParentShare salesOpen={salesOpen} />
            </div>
          </div>
        </section>

        {/* 7 · Closing */}
        <section id="closing" aria-labelledby="closing-heading" className={cn(sectionClass, 'text-center')}>
          <div className={container}>
            {/* The slope itself, drawn up to 800 once it is seen — not an empty
                score: nothing on this page shows one before there is one. */}
            <SlopeToGoal animate className="mx-auto w-40" />
            <h2 id="closing-heading" className={cn(h2Class, 'mt-4')}>
              800 isn’t a jump. It’s a slope.
            </h2>
            <p className={cn(bodyClass, 'mx-auto mt-4')}>
              Every line starts somewhere. One free Math module finds your starting point: a score estimate on the
              200–800 scale, with every question reviewed. Then it’s one module at a time.
            </p>
            <WarmupEchoLine className="mx-auto mt-3 max-w-[60ch]" />
            <div className="mt-8">
              <Link href="/register?from=final" className={buttonClass({ size: 'lg' })}>
                Start my free module
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

      <footer id="site-footer" className="border-t border-mist-200 py-8 text-sm text-mist-600">
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
          </nav>
        </div>

        <div className={cn(container, 'mt-4 grid gap-1')}>
          <p>
            Why slope.uz? <Var>y</Var> = <Var>mx</Var> + <Var>b</Var>. Keep <Var>m</Var> positive.
          </p>
          <p>SAT is a registered trademark of the College Board, which is not affiliated with MYSATuz.</p>
        </div>

        <div className={cn(container, 'mt-8')}>
          <div className="border-t border-mist-200 pt-6">
            <h3 className="text-sm font-semibold text-mist-900">Project developers</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {developers.map((developer) => (
                <div key={developer.name}>
                  <h4 className="text-sm font-medium text-mist-900">{developer.name}</h4>
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

      <StickyCta />
    </div>
  );
}
