'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileDown,
  History,
  Layers3,
  ListOrdered,
  Lock,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import {
  cleanTestDescription,
  findCategoryByQuery,
  getCategoryQueryValue,
  getTestCategory,
  type TestCategory,
  type TestCollectionOption,
} from '@/lib/testCatalog';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatModuleBadge } from '@/lib/examModules';
import { formatDuration, getOlympiadStatus, readOlympiadWindow, type OlympiadStatus } from '@/lib/olympiad';
import { formatDate } from '@/lib/formatDate';
import { formatCorrectOf, hasScoreEstimate } from '@/lib/scoreDisplay';
import { PREMIUM_PLAN } from '@/lib/plans';
import { PageHeader, SectionHeading, backLinkClass } from '@/components/ui/Page';
import { Card } from '@/components/ui/Card';
import { Badge, type Tone } from '@/components/ui/Badge';
import { buttonClass, iconButtonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { List, listRowInteractiveClass, rowChevronClass } from '@/components/ui/List';
import { Progress } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';

type CatalogTest = {
  id: string;
  title: string;
  description: string | null;
  collectionCategory: string | null;
  durationSeconds: number;
  moduleDurations: number[];
  maxAttempts: number;
  attemptsUsed: number;
  /** Questions the test shows (its original's, for a copy). */
  questionCount: number;
  /** This student's best attempt, or null before the first. */
  best: { score: number; correct: number | null } | null;
  isFree: boolean;
  visible: boolean;
  createdAt: string;
  /** ISO strings: dates do not survive the server-to-client boundary as Date. */
  olympiadStartsAt: string | null;
  olympiadEndsAt: string | null;
};

/**
 * The window of a catalog row, or null for an ordinary test. The dates arrive as
 * ISO strings, so they are revived before the shared helpers see them.
 */
function readCatalogOlympiad(test: CatalogTest) {
  return readOlympiadWindow({
    olympiadStartsAt: test.olympiadStartsAt ? new Date(test.olympiadStartsAt) : null,
    olympiadEndsAt: test.olympiadEndsAt ? new Date(test.olympiadEndsAt) : null,
  });
}

/** Amber only for the one pending state, an olympiad that has not opened yet. */
const OLYMPIAD_BADGE: Record<OlympiadStatus, { label: string; tone: Tone }> = {
  upcoming: { label: 'Upcoming', tone: 'warning' },
  running: { label: 'Live now', tone: 'accent' },
  finished: { label: 'Finished', tone: 'neutral' },
};

type PracticeCatalogProps = {
  tests: CatalogTest[];
  collections: TestCollectionOption[];
  isPremium: boolean;
  /** False while an admin has paused sales: a locked card then offers no unlock. */
  salesOpen: boolean;
  isAdmin: boolean;
  accessibleCategories: string[];
  canDownloadPdf: boolean;
  /** The course cards (CourseOverview), shown above the courses on the catalog's first view. */
  overview?: ReactNode;
  /** The first view's line under "Practice": it depends on what `overview` shows. */
  description?: string;
};

function categoryToQuery(category: TestCategory | null) {
  return category ? `?set=${encodeURIComponent(getCategoryQueryValue(category))}` : '';
}

/** The limit as what is left, not as a fraction that reads like a score. */
function formatAttemptsLeft(left: number) {
  if (left <= 0) return 'No attempts left';
  return `${left} ${left === 1 ? 'attempt' : 'attempts'} left`;
}

/**
 * Opening a test is the point of this page, so the click must not wait on a
 * server round trip — /exam/[id] is the heaviest route in the app and it
 * renders every formula on the server.
 *
 * Prefetching the full route for every visible card is not an option either:
 * one card's payload is roughly half a megabyte, and a collection can hold
 * twenty of them. So the full route is pulled only once the user shows intent.
 * Until then `prefetch={null}` keeps the cheap default — the shell up to
 * exam/[id]/loading.tsx. Pattern comes from the Next 16 prefetching guide.
 *
 * `onPointerDown` is what covers touch: hover never fires there, and firing at
 * press start buys the prefetch a head start before the tap completes.
 */
function StartPracticeLink({ testId }: { testId: string }) {
  const [intent, setIntent] = useState(false);
  const showIntent = () => setIntent(true);

  return (
    <Link
      href={`/exam/${testId}`}
      prefetch={intent ? true : null}
      onMouseEnter={showIntent}
      onFocus={showIntent}
      onPointerDown={showIntent}
      className={buttonClass()}
    >
      Start test
    </Link>
  );
}

/**
 * Every attempt stays reviewable whatever happens to the card - the limit is
 * reached, the subscription runs out - so the way back to them is on the card
 * itself. Outlined: as a ghost button it read as a plain caption under Start.
 */
function PastResultsLink({ testId, attemptsUsed }: { testId: string; attemptsUsed: number }) {
  return (
    <Link
      href={`/dashboard/results?test=${encodeURIComponent(testId)}`}
      title="Review past attempts"
      className={buttonClass({ variant: 'secondary' })}
    >
      <History className="h-4 w-4" />
      <span className="tabular-nums">
        {attemptsUsed} {attemptsUsed === 1 ? 'attempt' : 'attempts'}
      </span>
    </Link>
  );
}

export default function PracticeCatalog({
  tests,
  collections,
  isPremium,
  salesOpen,
  isAdmin,
  accessibleCategories,
  canDownloadPdf,
  overview,
  description: homeDescription,
}: PracticeCatalogProps) {
  const [isPending, startTransition] = useTransition();
  const visibleCollections = useMemo(
    () => collections.filter((collection) => collection.visible),
    [collections]
  );
  const accessibleCategorySet = useMemo(
    () => new Set(accessibleCategories),
    [accessibleCategories]
  );

  // The URL is the only record of the open collection. A copy in state kept
  // the collection open when a link came back to this same page - the
  // sidebar's Practice, the course card's "Open the course" - because a
  // change of search params alone does not remount the page. Next feeds
  // pushState and Back into useSearchParams, so all of them land here.
  const searchParams = useSearchParams();
  const activeCategory = findCategoryByQuery(visibleCollections, searchParams.get('set') ?? undefined);

  const testsByCategory = useMemo(() => {
    const grouped = new Map<TestCategory, CatalogTest[]>();

    for (const collection of visibleCollections) {
      grouped.set(collection.value, []);
    }

    for (const test of tests) {
      if (!test.visible && !canDownloadPdf) continue;

      const category = getTestCategory(test);
      if (category && grouped.has(category)) {
        grouped.get(category)?.push(test);
      }
    }

    return grouped;
  }, [canDownloadPdf, tests, visibleCollections]);

  const activeCollection = activeCategory
    ? visibleCollections.find((collection) => collection.value === activeCategory) ?? null
    : null;
  const effectiveActiveCategory = activeCollection?.value ?? null;
  const visibleTests = effectiveActiveCategory ? testsByCategory.get(effectiveActiveCategory) ?? [] : [];

  // No server round trip: the catalog already holds every collection's tests.
  const switchCategory = (category: TestCategory | null) => {
    startTransition(() => {
      window.history.pushState(null, '', `/dashboard${categoryToQuery(category)}`);
    });
  };

  // The grids follow this column's width, not the viewport's: from md the
  // sidebar takes 80-240px, so a viewport breakpoint would squeeze the cards.
  // Three a row from 48rem: Start, the attempts link and the admin's PDF button
  // fit on one line of a card that wide.
  return (
    <div className="@container min-w-0 space-y-6">
      <PageHeader
        back={
          effectiveActiveCategory ? (
            <button type="button" onClick={() => switchCategory(null)} className={backLinkClass}>
              <ArrowLeft className="h-4 w-4" />
              Back to courses
            </button>
          ) : null
        }
        title={activeCollection ? activeCollection.label : 'Practice'}
        description={activeCollection?.description || homeDescription || 'Choose a course, then a test.'}
      />

      {!effectiveActiveCategory && overview}
      {!effectiveActiveCategory && overview && visibleCollections.length > 0 && (
        // mb-3 replaces the 24px space-y step below the heading: it belongs to the list.
        <SectionHeading title="All courses" className="mb-3" />
      )}

      {!effectiveActiveCategory ? (
        visibleCollections.length === 0 ? (
          <EmptyState icon={<Layers3 />} title="No courses are open to you yet" />
        ) : (
          // Collections are records without actions of their own, so they are
          // one List: the name, the whole description (it is what tells two
          // collections apart), and how much of it the student has taken.
          <List>
            {visibleCollections.map((collection) => {
              const collectionTests = testsByCategory.get(collection.value) ?? [];
              const count = collectionTests.length;
              const taken = collectionTests.filter((test) => test.attemptsUsed > 0).length;

              return (
                <li key={collection.value}>
                  <button
                    type="button"
                    onClick={() => switchCategory(collection.value)}
                    disabled={isPending}
                    // No opacity while the switch is pending: a faded row reads
                    // as broken, and the switch takes a frame, not a request.
                    className={cn(listRowInteractiveClass, 'group w-full text-left disabled:cursor-wait')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900">{collection.label}</span>
                      {collection.description && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-gray-500 sm:line-clamp-1">
                          {collection.description}
                        </span>
                      )}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-gray-500 sm:w-32">
                      {taken > 0 ? (
                        <>
                          <Progress value={(taken / count) * 100} />
                          <span className="mt-1 block">{taken} of {count} taken</span>
                        </>
                      ) : (
                        `${count} ${count === 1 ? 'test' : 'tests'}`
                      )}
                    </span>
                    <ChevronRight className={rowChevronClass} />
                  </button>
                </li>
              );
            })}
          </List>
        )
      ) : visibleTests.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title="No tests in this course yet" description="Tests appear here when they are added." />
      ) : (
        // grid-cols-1 below @lg on purpose: without a template the implicit
        // track is `auto` and grows to the longest unbroken line, which pushed
        // the cards past the right edge of a phone.
        <ul className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-3">
          {visibleTests.map((test) => {
            const category = getTestCategory(test);
            const hasSectionAccess = Boolean(category && accessibleCategorySet.has(category));
            const canAccess = isAdmin || test.isFree || isPremium || hasSectionAccess;
            const attemptLimitReached = !isAdmin && test.attemptsUsed >= test.maxAttempts;
            // "Free" is the test's own mark (Test.isFree), not a plan; a paid
            // test names the plan it comes with, as plans.ts spells it.
            const accessLabel = test.isFree
              ? 'Free'
              : hasSectionAccess && !isPremium
                ? 'Course access'
                : PREMIUM_PLAN.name;
            // Only a description the test really has: the per-collection
            // default repeated the collection's own description on every card.
            const description = cleanTestDescription(test.description);
            const moduleBadge = formatModuleBadge(test);
            const olympiad = readCatalogOlympiad(test);
            const olympiadStatus = olympiad ? getOlympiadStatus(olympiad) : null;
            // A short check has no score worth comparing, so its best is a count.
            const bestLabel = !test.best
              ? null
              : hasScoreEstimate(test.questionCount)
                ? `Best ${test.best.score}`
                : test.best.correct !== null
                  ? `Best ${formatCorrectOf(test.best.correct, test.questionCount)}`
                  : null;

            // Compact card: title (+ one line of description), one line of
            // facts, one row of actions. Access is the only pill; the rest are
            // plain facts, so the card reads calmly.
            return (
              <Card as="li" key={test.id} className="flex min-w-0 flex-col gap-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-base font-semibold text-gray-900">{test.title}</h2>
                    {description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{description}</p>}
                  </div>
                  {!canAccess && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" role="img" aria-label="Locked" />}
                </div>

                {/* Each fact is one unbreakable item with its own icon instead
                    of a "·" between them: the line wraps between facts in a
                    narrow card, and no separator is left hanging at either end. */}
                <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">
                  <li className="flex gap-1.5">
                    <Badge tone={test.isFree ? 'accent' : 'neutral'}>{accessLabel}</Badge>
                    {olympiadStatus && (
                      <Badge tone={OLYMPIAD_BADGE[olympiadStatus].tone}>
                        <Trophy />
                        {OLYMPIAD_BADGE[olympiadStatus].label}
                      </Badge>
                    )}
                  </li>
                  {/* Both formats read right: "44 questions · 2 modules × 35 min"
                      for a two-module test, "30 questions · 35 min" for one
                      block on one timer. */}
                  {test.questionCount > 0 && (
                    <li className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                      <ListOrdered className="h-3.5 w-3.5" aria-hidden />
                      {test.questionCount} {test.questionCount === 1 ? 'question' : 'questions'}
                    </li>
                  )}
                  <li className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    {moduleBadge ?? formatDuration(test.durationSeconds)}
                  </li>
                  {/* A finished olympiad cannot be taken again, so attempts
                      left would only read as an invitation it cannot keep. */}
                  <li className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                    {olympiad && olympiadStatus === 'finished' ? (
                      <>
                        <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                        Ended {formatDate(olympiad.endsAt)}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        {isAdmin ? 'Unlimited attempts' : formatAttemptsLeft(test.maxAttempts - test.attemptsUsed)}
                      </>
                    )}
                  </li>
                  {bestLabel && (
                    <li className="inline-flex items-center gap-1 whitespace-nowrap font-medium tabular-nums text-gray-700">
                      <Award className="h-3.5 w-3.5" aria-hidden />
                      {bestLabel}
                    </li>
                  )}
                </ul>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {canAccess ? (
                    <>
                      {olympiad ? (
                        // An olympiad always goes through its own page first: the
                        // rules, the window and the ranking live there, and the
                        // test itself is closed outside the window anyway. The
                        // ranking stays worth opening after the last attempt.
                        <Link href={`/olympiad/${test.id}`} className={buttonClass()}>
                          {olympiadStatus === 'finished' ? 'See the ranking' : 'Open olympiad'}
                        </Link>
                      ) : attemptLimitReached ? (
                        <p className="text-sm font-medium text-gray-500">Attempt limit reached</p>
                      ) : (
                        <StartPracticeLink testId={test.id} />
                      )}
                      {test.attemptsUsed > 0 && (
                        <PastResultsLink testId={test.id} attemptsUsed={test.attemptsUsed} />
                      )}
                      {canDownloadPdf && (
                        <Link
                          href={`/exam/${test.id}/pdf`}
                          prefetch={false}
                          aria-label="Download questions PDF"
                          title="Download questions PDF"
                          // md, level with Start and the attempts link beside it.
                          className={iconButtonClass({ variant: 'secondary', className: 'ml-auto' })}
                        >
                          <FileDown className="h-4 w-4" />
                        </Link>
                      )}
                    </>
                  ) : (
                    <>
                      {salesOpen ? (
                        <Link
                          href="/dashboard/subscription"
                          className={buttonClass({ variant: 'secondary' })}
                        >
                          Unlock with {PREMIUM_PLAN.name}
                        </Link>
                      ) : (
                        // Paused by an admin: a calm fact beside the lock above,
                        // never a link to a page with nothing to buy.
                        <p className="text-sm text-gray-600">{PREMIUM_PLAN.name} is paused for now</p>
                      )}
                      {test.attemptsUsed > 0 && (
                        <PastResultsLink testId={test.id} attemptsUsed={test.attemptsUsed} />
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
