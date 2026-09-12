import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildExamModules } from '@/lib/examModules';
import { formatCreditTotal, isMultiSelectKey } from '@/lib/resultAnswers';
import { formatResultTime } from '@/lib/resultSections';
import {
  TEST_ROSTER_PAGE_SIZE,
  fetchQuestionStats,
  fetchTestParticipation,
  fetchTestRoster,
  questionExcerpt,
  readQuestionStat,
} from '@/lib/testStats';
import { getCategoryLabel, getTestCategory, getTestCollections } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  ImageIcon,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Below this share of credit a question is called out as hard. */
const HARD_QUESTION_ACCURACY = 0.5;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: Date | string | null) {
  if (!value) return 'No attempts';

  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 1 ? Math.floor(parsed) : 1;
}

export default async function AdminTestStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ testId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const currentPage = parsePage(resolvedSearchParams?.page);
  const skip = (currentPage - 1) * TEST_ROSTER_PAGE_SIZE;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      title: true,
      collectionCategory: true,
      durationSeconds: true,
      moduleDurations: true,
      questions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          moduleIndex: true,
          content: true,
          correctAnswer: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!test) {
    notFound();
  }

  const [collectionRows, participation, roster, questionStats, totals] = await Promise.all([
    getCollectionVisibilityRows(),
    fetchTestParticipation(test.id),
    fetchTestRoster(test.id, { take: TEST_ROSTER_PAGE_SIZE, skip }),
    fetchQuestionStats(test.id),
    prisma.result.aggregate({
      where: { testId: test.id },
      _avg: { score: true, timeSpent: true, correctCount: true },
      _max: { score: true },
    }),
  ]);

  const collections = getTestCollections(collectionRows);
  const category = getTestCategory(test);
  const categoryLabel = category ? getCategoryLabel(category, collections) : 'Unassigned';
  const modules = buildExamModules(test, test.questions);
  const isModular = modules.length > 1;
  const questionCount = test.questions.length;

  const averageScore = Math.round(totals._avg.score ?? 0);
  const bestScore = totals._max.score ?? 0;
  const averageSolved = totals._avg.correctCount ?? 0;
  const averageTime = Math.round(totals._avg.timeSpent ?? 0);
  const averageAccuracy = questionCount > 0 ? averageSolved / questionCount : 0;

  const totalPages = Math.max(1, Math.ceil(participation.students / TEST_ROSTER_PAGE_SIZE));
  const statsHref = `/admin/tests/${test.id}/stats`;

  const stats = [
    { label: 'Students', value: String(participation.students), icon: Users },
    { label: 'Attempts', value: String(participation.attempts), icon: UserRound },
    { label: 'Average score', value: String(averageScore), icon: BarChart3 },
    { label: 'Average accuracy', value: formatPercent(averageAccuracy), icon: Target },
  ];

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin/tests"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tests
          </Link>
          <Link
            href={`/admin/tests/${test.id}`}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <Edit3 className="h-4 w-4" />
            Open question editor
          </Link>
        </div>

        <header className="rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-blue-300">
            {categoryLabel}
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">{test.title}</h1>
          <p className="mt-3 text-sm font-medium text-slate-300">
            {questionCount} questions
            {isModular ? ` | ${modules.length} modules` : ''}
            {participation.attempts > 0 ? ` | best score ${bestScore}` : ''}
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 inline-flex rounded-xl bg-blue-50 p-3 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{stat.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-600">
              Student by student
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Who took it, and how many each solved
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {participation.students > 0
                ? `Showing ${roster.length ? skip + 1 : 0}-${skip + roster.length} of ${participation.students}. `
                : ''}
              A student who retook the test is ranked on their best attempt, and the
              score and time beside a solved count come from that same attempt.
            </p>
          </div>

          {roster.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-400">
              {participation.students > 0
                ? 'No students on this page. Go back to the first page.'
                : 'Nobody has taken this test yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {roster.map((student, index) => {
                const rank = skip + index + 1;
                const accuracy = questionCount > 0 ? student.bestCorrect / questionCount : 0;

                return (
                  <Link
                    key={student.userId}
                    href={`/admin/users/${student.userId}`}
                    prefetch={false}
                    className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white md:grid-cols-[auto_1fr_18rem]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-500 tabular-nums">
                      #{rank}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {student.name || student.email}
                      </h3>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                        {student.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        <span className="rounded-full bg-white px-2 py-0.5 tabular-nums">
                          {student.attempts} {student.attempts === 1 ? 'attempt' : 'attempts'}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5">
                          {formatResultTime(student.bestTimeSpent)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5">
                          Last {formatDate(student.latestAt)}
                        </span>
                        {student.attempts > 1 && (
                          <span className="rounded-full bg-white px-2 py-0.5 tabular-nums">
                            Each attempt {student.correctCounts.map(formatCreditTotal).join(' / ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col justify-center gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 tabular-nums">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          {formatCreditTotal(student.bestCorrect)}
                          <span className="font-medium text-slate-400">/ {questionCount} solved</span>
                        </span>
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          {student.bestScore}
                          <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            score
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-emerald-600"
                          style={{ width: `${Math.round(accuracy * 100)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {currentPage > 1 ? (
                <Link
                  href={currentPage - 1 === 1 ? statsHref : `${statsHref}?page=${currentPage - 1}`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={`${statsHref}?page=${currentPage + 1}`}
                  prefetch={false}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-blue-600">
              Question by question
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">How many got each one right</h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Counted over every attempt at this test. A multi-select question can be partly right,
              so its solved total is not always a whole number.
            </p>
          </div>

          {participation.attempts === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-400">
              Nobody has taken this test yet.
            </div>
          ) : (
            <div className="space-y-6">
              {modules.map((module) => (
                <div key={module.index} className="space-y-3">
                  {isModular && (
                    <h3 className="text-sm font-medium uppercase tracking-widest text-slate-500">
                      Module {module.index}
                    </h3>
                  )}

                  {module.questions.map((question, index) => {
                    const stat = readQuestionStat(questionStats, question.id);
                    const accuracy = stat.responses > 0 ? stat.credit / stat.responses : 0;
                    const isHard = stat.responses > 0 && accuracy < HARD_QUESTION_ACCURACY;

                    return (
                      <div
                        key={question.id}
                        className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[auto_1fr_16rem]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-500 tabular-nums">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {questionExcerpt(question.content) || 'Untitled question'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                            <span className="rounded-full bg-white px-2 py-0.5">
                              Answer {question.correctAnswer}
                            </span>
                            {isMultiSelectKey(question.correctAnswer) && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                                Multi-select
                              </span>
                            )}
                            {question.imageUrl && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
                                <ImageIcon className="h-3 w-3" />
                                Diagram
                              </span>
                            )}
                            {stat.blank > 0 && (
                              <span className="rounded-full bg-white px-2 py-0.5 tabular-nums">
                                {stat.blank} left blank
                              </span>
                            )}
                            {isHard && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600">
                                Hard
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col justify-center gap-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 tabular-nums">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              {formatCreditTotal(stat.credit)}
                              <span className="font-medium text-slate-400">/ {stat.responses}</span>
                            </span>
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {formatPercent(accuracy)}
                            </span>
                          </div>
                          {/* Track and fill, one accent: the bar is the same
                              "correct" emerald the review pages use, so a short
                              bar reads as few correct answers without inventing
                              a second colour for it. */}
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-emerald-600"
                              style={{ width: `${Math.round(accuracy * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        {participation.attempts > 0 && (
          <p className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <Clock className="h-4 w-4" />
            An attempt takes {formatResultTime(averageTime)} on average
          </p>
        )}
      </div>
    </div>
  );
}
