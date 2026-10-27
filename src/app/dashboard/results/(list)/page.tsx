import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, ClipboardList, Play, X } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { formatDuration } from '@/lib/olympiad';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { formatCorrectOf, hasScoreEstimate } from '@/lib/scoreDisplay';
import { Page, PageHeader } from '@/components/ui/Page';
import { buttonClass, linkClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import {
  List,
  RowText,
  listRowInteractiveClass,
  rowChevronClass,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from '@/components/ui/List';
import { ChipCheck, chipClass, segmentClass, segmentedClass } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';
import ScoreDelta from '@/components/dashboard/ScoreDelta';

export const metadata: Metadata = { title: 'Results' };

/**
 * Every finished attempt, in two views.
 *
 * "By test" (the default) is one row per test: the latest and best score and
 * how the latest moved against the one before - is the student getting better
 * at this test. "All attempts" is every attempt, newest first: the one place
 * that lists them all, so an old review can always be found again (the
 * dashboard's recent activity used to be the only way in, and a retake or five
 * other tests pushed an attempt off it within a day).
 *
 * `?test=<id>` narrows "All attempts" to one test; the catalog card, the result
 * page and the attempt-limit notice link here that way, and a chip clears it.
 */
const PAGE_SIZE = 20;

/** Test ids are uuids; anything longer is not worth a database round-trip. */
const MAX_ID_LENGTH = 160;

type SearchParams = { [key: string]: string | string[] | undefined };

function readTestId(value: string | string[] | undefined) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
    ? value
    : null;
}

/**
 * Far past any real history, and small enough that the offset stays a valid
 * 64-bit `skip`: `?page=1e21` used to crash the page in Prisma. Anything
 * higher is clamped to it and then, like any page past the end, sent to the
 * last page there is.
 */
const MAX_PAGE = 10_000;

function readPage(value: string | string[] | undefined) {
  const page = typeof value === 'string' ? Number(value) : 1;
  return Number.isInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
}

const BY_TEST_HREF = '/dashboard/results';

function attemptsHref(testId: string | null, page = 1) {
  const params = new URLSearchParams();
  // A test filter only exists in this view, so it implies it.
  if (testId) params.set('test', testId);
  else params.set('view', 'attempts');
  if (page > 1) params.set('page', String(page));
  return `/dashboard/results?${params.toString()}`;
}

const numericThClass = cn(thClass, 'text-right');
const numericTdClass = cn(tdClass, 'text-right tabular-nums');

/*
 * The table rows open like the list rows do: the title link's ::after covers
 * the whole row, which is `relative` for it. Anything else clickable in a row
 * sits above it with `relative z-10`. Each row ends in the list rows'
 * chevron, so it reads as something that opens before it is hovered (a touch
 * screen never hovers); `group` tints it with the row.
 */
const rowClass = 'group relative transition-colors hover:bg-gray-50';
const chevronThClass = cn(thClass, 'w-px');
const chevronTdClass = cn(tdClass, 'w-px');
const rowLinkClass = cn(
  'font-medium text-gray-900 after:absolute after:inset-0 hover:text-ink-600 focus-visible:outline-none',
  'focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink-600'
);

type Attempt = { id: string; score: number; correctCount: number | null; createdAt: Date };

/** A copy shows its original's questions and has none of its own. */
const TEST_FIELDS = {
  title: true,
  _count: { select: { questions: true } },
  questionSource: { select: { _count: { select: { questions: true } } } },
} as const;

function questionCountOf(test: { _count: { questions: number }; questionSource: { _count: { questions: number } } | null }) {
  return test.questionSource?._count.questions ?? test._count.questions;
}

/**
 * What a cell says for one attempt: the score, or on a check too short for a
 * score, the count of right answers.
 */
function attemptValue(attempt: Attempt, questionCount: number) {
  if (hasScoreEstimate(questionCount)) return String(attempt.score);
  return attempt.correctCount !== null ? formatCorrectOf(attempt.correctCount, questionCount) : '—';
}

/** Latest against the attempt before it, in the unit `attemptValue` uses. */
function attemptDelta(latest: Attempt, previous: Attempt | null, questionCount: number) {
  if (!previous) return null;
  if (hasScoreEstimate(questionCount)) return { value: latest.score - previous.score, unit: undefined };
  if (latest.correctCount === null || previous.correctCount === null) return null;
  return { value: latest.correctCount - previous.correctCount, unit: 'correct' };
}

export default async function ResultsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (!session?.user?.id) return <div>Unauthorized</div>;

  const userId = session.user.id;
  const testId = readTestId(searchParams.test);
  const view = testId || searchParams.view === 'attempts' ? 'attempts' : 'tests';

  return (
    <Page>
      <PageHeader
        title="Results"
        description={
          view === 'tests'
            ? 'Your latest and best score on every test you have finished.'
            : 'Every attempt, newest first. Open one to review it question by question.'
        }
      />

      {view === 'tests' ? (
        <ByTestView userId={userId} />
      ) : (
        <AttemptsView userId={userId} testId={testId} page={readPage(searchParams.page)} />
      )}
    </Page>
  );
}

function ViewSwitch({ view, filter }: { view: 'tests' | 'attempts'; filter?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Results view" className={segmentedClass}>
        <Link href={BY_TEST_HREF} aria-current={view === 'tests' ? 'page' : undefined} className={segmentClass(view === 'tests')}>
          By test
        </Link>
        <Link
          href={attemptsHref(null)}
          aria-current={view === 'attempts' ? 'page' : undefined}
          className={segmentClass(view === 'attempts')}
        >
          All attempts
        </Link>
      </nav>
      {filter}
    </div>
  );
}

/** Nothing finished yet: the one thing to do about it. */
function NoResults() {
  return (
    <EmptyState
      icon={<ClipboardList />}
      title="No tests finished yet"
      description="Finish a test to see your result and a review of every answer."
      action={
        <Link href="/dashboard" className={buttonClass()}>
          <Play className="h-4 w-4" />
          Start a test
        </Link>
      }
    />
  );
}

async function ByTestView({ userId }: { userId: string }) {
  // Every attempt, light rows: the per-test latest, best and change need them
  // all, and even a heavy user has a few hundred. [userId, createdAt] serves it.
  const attempts = await prisma.result.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      testId: true,
      score: true,
      correctCount: true,
      createdAt: true,
      test: { select: TEST_FIELDS },
    },
  });

  if (attempts.length === 0) return <NoResults />;

  // Newest first, so the first attempt seen of a test is its latest, the
  // second the one to compare it with, and tests come out most recent first.
  const byTest = new Map<
    string,
    { testId: string; title: string; questionCount: number; count: number; latest: Attempt; previous: Attempt | null; best: Attempt }
  >();
  for (const attempt of attempts) {
    const row = byTest.get(attempt.testId);
    if (!row) {
      byTest.set(attempt.testId, {
        testId: attempt.testId,
        title: attempt.test.title,
        questionCount: questionCountOf(attempt.test),
        count: 1,
        latest: attempt,
        previous: null,
        best: attempt,
      });
      continue;
    }

    row.count += 1;
    if (!row.previous) row.previous = attempt;
    // Best by the same measure the cell shows; a tie keeps the more recent attempt.
    const better = hasScoreEstimate(row.questionCount)
      ? attempt.score > row.best.score
      : (attempt.correctCount ?? -1) > (row.best.correctCount ?? -1);
    if (better) row.best = attempt;
  }
  const rows = [...byTest.values()];

  return (
    <div className="@container space-y-3">
      <ViewSwitch view="tests" />

      {/* Phones: a list row per test, the whole row a link. */}
      <List className="@3xl:hidden">
        {rows.map((row) => {
          const delta = attemptDelta(row.latest, row.previous, row.questionCount);
          const isScored = hasScoreEstimate(row.questionCount);

          return (
            <li key={row.testId}>
              <Link href={`/dashboard/results/${row.latest.id}`} className={cn(listRowInteractiveClass, 'group')}>
                <RowText
                  title={row.title}
                  meta={
                    <span className="tabular-nums">
                      {row.count} {row.count === 1 ? 'attempt' : 'attempts'}
                      {row.count > 1 && ` · best ${attemptValue(row.best, row.questionCount)}`}
                      {' · '}
                      {formatDate(row.latest.createdAt)}
                    </span>
                  }
                />
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={cn(
                      'tabular-nums text-gray-900',
                      isScored ? 'text-base font-semibold' : 'text-sm font-medium'
                    )}
                  >
                    {attemptValue(row.latest, row.questionCount)}
                  </span>
                  {/* The table's "Change" header says what it compares; a row
                      has to say it itself. */}
                  {delta && <ScoreDelta delta={delta.value} unit={delta.unit} against="the previous attempt" />}
                </div>
                <ChevronRight className={rowChevronClass} />
              </Link>
            </li>
          );
        })}
      </List>

      {/* Wide: a table, so the numbers line up in columns next to their test
          instead of sitting at the far end of a long row. */}
      <div className={cn(tableWrapClass, 'hidden @3xl:block')}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th scope="col" className={thClass}>Test</th>
              <th scope="col" className={thClass}>Last taken</th>
              <th scope="col" className={numericThClass}>Attempts</th>
              <th scope="col" className={numericThClass}>Best</th>
              <th scope="col" className={numericThClass}>Latest</th>
              <th scope="col" className={thClass}>Change</th>
              <th aria-hidden className={chevronThClass} />
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {rows.map((row) => {
              const delta = attemptDelta(row.latest, row.previous, row.questionCount);

              return (
                <tr key={row.testId} className={rowClass}>
                  <td className={tdClass}>
                    <Link href={`/dashboard/results/${row.latest.id}`} className={rowLinkClass}>
                      {row.title}
                    </Link>
                  </td>
                  <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>{formatDate(row.latest.createdAt)}</td>
                  <td className={numericTdClass}>
                    {row.count > 1 ? (
                      <Link
                        href={attemptsHref(row.testId)}
                        // Underlined: beside the plain counts of the other
                        // rows, colour alone did not say it opens anything.
                        // z-10 lifts it over the row link's cover.
                        className={cn(linkClass, 'relative z-10')}
                      >
                        {row.count}
                        <span className="sr-only"> attempts: show them all</span>
                      </Link>
                    ) : (
                      row.count
                    )}
                  </td>
                  <td className={numericTdClass}>{attemptValue(row.best, row.questionCount)}</td>
                  <td className={cn(numericTdClass, 'font-semibold text-gray-900')}>
                    {attemptValue(row.latest, row.questionCount)}
                  </td>
                  <td className={tdClass}>
                    {delta ? (
                      <ScoreDelta delta={delta.value} unit={delta.unit} />
                    ) : (
                      <span className="text-xs text-gray-500">First attempt</span>
                    )}
                  </td>
                  <td className={chevronTdClass}>
                    <ChevronRight className={rowChevronClass} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function AttemptsView({ userId, testId, page }: { userId: string; testId: string | null; page: number }) {
  // [userId, createdAt] serves the full list, [userId, testId] the narrowed one.
  const where = testId ? { userId, testId } : { userId };

  const [total, results] = await Promise.all([
    prisma.result.count({ where }),
    prisma.result.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        score: true,
        correctCount: true,
        timeSpent: true,
        createdAt: true,
        test: { select: TEST_FIELDS },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // An old bookmark, or attempts removed since: the last page that has any.
  if (page > pageCount) {
    redirect(attemptsHref(testId, pageCount));
  }

  if (total === 0 && !testId) return <NoResults />;

  // Only ever named from the student's own attempts, so a hidden test's title
  // is not shown to someone who never took it.
  const testTitle = testId ? results[0]?.test.title ?? null : null;
  const rows = results.map((result, index) => ({
    ...result,
    questionCount: questionCountOf(result.test),
    // Newest first, so the attempt number counts down the list.
    attemptNumber: total - ((page - 1) * PAGE_SIZE + index),
  }));

  return (
    <div className="@container space-y-3">
      <ViewSwitch
        view="attempts"
        filter={
          testId && (
            // The filter in force, drawn as the selected chip it is; the X
            // and the whole chip clear it.
            <Link href={attemptsHref(null)} className={chipClass(true, 'min-w-0 max-w-full')}>
              <ChipCheck active />
              <span className="truncate">Test: {testTitle ?? 'one test'}</span>
              <X className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">Clear the filter and show every attempt</span>
            </Link>
          )
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No finished attempts at this test yet"
          action={
            <Link href={attemptsHref(null)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Show all attempts
            </Link>
          }
        />
      ) : (
        <>
          <List className="@3xl:hidden">
            {rows.map((row) => {
              const isScored = hasScoreEstimate(row.questionCount);

              return (
                <li key={row.id}>
                  <Link href={`/dashboard/results/${row.id}`} className={cn(listRowInteractiveClass, 'group')}>
                    <RowText
                      title={testId ? `Attempt ${row.attemptNumber}` : row.test.title}
                      meta={
                        <span className="tabular-nums">
                          {formatDateTime(row.createdAt)}
                          {' · '}
                          {formatDuration(row.timeSpent)}
                          {isScored && row.correctCount !== null && ` · ${formatCorrectOf(row.correctCount, row.questionCount)} correct`}
                        </span>
                      }
                    />
                    <span
                      className={cn(
                        'shrink-0 tabular-nums text-gray-900',
                        isScored ? 'text-base font-semibold' : 'text-sm font-medium'
                      )}
                    >
                      {isScored
                        ? row.score
                        : row.correctCount !== null && `${formatCorrectOf(row.correctCount, row.questionCount)} correct`}
                    </span>
                    <ChevronRight className={rowChevronClass} />
                  </Link>
                </li>
              );
            })}
          </List>

          <div className={cn(tableWrapClass, 'hidden @3xl:block')}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>{testId ? 'Attempt' : 'Test'}</th>
                  <th scope="col" className={thClass}>Completed</th>
                  <th scope="col" className={numericThClass}>Time</th>
                  <th scope="col" className={numericThClass}>Correct</th>
                  <th scope="col" className={numericThClass}>Score</th>
                  <th aria-hidden className={chevronThClass} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {rows.map((row) => (
                  <tr key={row.id} className={rowClass}>
                    <td className={tdClass}>
                      <Link href={`/dashboard/results/${row.id}`} className={rowLinkClass}>
                        {testId ? `Attempt ${row.attemptNumber}` : row.test.title}
                      </Link>
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>{formatDateTime(row.createdAt)}</td>
                    <td className={cn(numericTdClass, 'whitespace-nowrap')}>{formatDuration(row.timeSpent)}</td>
                    <td className={cn(numericTdClass, 'whitespace-nowrap')}>
                      {row.correctCount !== null ? formatCorrectOf(row.correctCount, row.questionCount) : '—'}
                    </td>
                    <td className={cn(numericTdClass, 'font-semibold text-gray-900')}>
                      {/* A short check has no score worth printing: its count
                          is the column beside. */}
                      {hasScoreEstimate(row.questionCount) ? (
                        row.score
                      ) : (
                        <>
                          <span aria-hidden className="font-normal text-gray-500">—</span>
                          <span className="sr-only">No score estimate</span>
                        </>
                      )}
                    </td>
                    <td className={chevronTdClass}>
                      <ChevronRight className={rowChevronClass} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-between gap-3 pt-3" aria-label="Results pages">
          {page > 1 ? (
            <Link href={attemptsHref(testId, page - 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              <ChevronLeft className="h-4 w-4" />
              Newer
            </Link>
          ) : <span />}
          <span className="text-xs text-gray-600 tabular-nums">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={attemptsHref(testId, page + 1)} className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Older
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
