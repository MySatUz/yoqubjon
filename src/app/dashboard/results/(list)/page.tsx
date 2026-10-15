import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { formatCreditTotal } from '@/lib/resultAnswers';
import { formatResultTime } from '@/lib/resultSections';

/**
 * Every finished attempt, newest first: the one place that lists them all.
 *
 * Before this page the only links to a result were the dashboard's Recent
 * Activity - the newest attempt at each of the last five tests taken - and the
 * profile's latest 50. A retake, or five other tests, took an attempt off the
 * dashboard, usually within a day, so a student who opened their review right
 * after finishing could not find it again later, though it was never gone.
 *
 * `?test=<id>` narrows the list to one test; the catalog card, the result page
 * and the attempt-limit notice link here that way.
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

function resultsHref(testId: string | null, page: number) {
  const params = new URLSearchParams();
  if (testId) params.set('test', testId);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/dashboard/results?${query}` : '/dashboard/results';
}

export default async function ResultsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (!session?.user?.id) return <div>Unauthorized</div>;

  const userId = session.user.id;
  const testId = readTestId(searchParams.test);
  const page = readPage(searchParams.page);
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
        test: {
          select: {
            title: true,
            _count: { select: { questions: true } },
            // A copy shows its original's questions and has none of its own.
            questionSource: { select: { _count: { select: { questions: true } } } },
          },
        },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // An old bookmark, or attempts removed since: the last page that has any.
  if (page > pageCount) {
    redirect(resultsHref(testId, pageCount));
  }

  // Only ever named from the student's own attempts, so a hidden test's title
  // is not shown to someone who never took it.
  const testTitle = testId ? results[0]?.test.title ?? null : null;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-blue-600">Student workspace</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">My Results</h1>
          <p className="mt-2 font-medium text-slate-500">
            Every test you have finished. Open one to see which questions you got right and wrong.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          Continue Practice
        </Link>
      </header>

      {testId && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <p className="min-w-0 text-sm font-medium text-slate-600">
            {testTitle ? (
              <>Attempts at <span className="font-semibold text-slate-900">{testTitle}</span></>
            ) : (
              'Attempts at one test'
            )}
          </p>
          <Link href="/dashboard/results" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Show all results
          </Link>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-400">
            {testId ? 'No finished attempts at this test yet.' : 'No tests finished yet. Your results will appear here.'}
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-400">There are no results on this page.</p>
          <Link href={resultsHref(testId, 1)} className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
            Go to the first page
          </Link>
        </div>
      ) : (
        <ol className="space-y-3">
          {results.map((result, index) => {
            const questionCount = result.test.questionSource?._count.questions ?? result.test._count.questions;
            // Newest first, so the attempt number counts down the list.
            const attemptNumber = total - ((page - 1) * PAGE_SIZE + index);

            return (
              <li key={result.id}>
                <Link
                  href={`/dashboard/results/${result.id}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {testId ? `Attempt ${attemptNumber}` : result.test.title}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {new Date(result.createdAt).toLocaleDateString()}
                      {' · '}
                      {formatResultTime(result.timeSpent)}
                      {result.correctCount !== null && questionCount > 0 && (
                        <>
                          {' · '}
                          <span className="tabular-nums">
                            {formatCreditTotal(result.correctCount)} of {questionCount} correct
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white tabular-nums">
                      {result.score}
                    </span>
                    <span className="hidden items-center gap-1 text-sm font-semibold text-blue-600 sm:inline-flex">
                      Review
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {pageCount > 1 && (
        <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Results pages">
          {page > 1 ? (
            <Link
              href={resultsHref(testId, page - 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
            >
              <ChevronLeft className="h-4 w-4" />
              Newer
            </Link>
          ) : <span />}
          <span className="text-xs font-medium text-slate-400 tabular-nums">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={resultsHref(testId, page + 1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
            >
              Older
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
