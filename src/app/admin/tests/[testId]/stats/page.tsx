import 'katex/dist/katex.min.css';
import type { Metadata } from 'next';
import { cache } from 'react';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildExamModules } from '@/lib/examModules';
import { formatDuration } from '@/lib/olympiad';
import { getShownQuestions } from '@/lib/questionSource';
import { formatCreditTotal } from '@/lib/resultAnswers';
import { formatCorrectOf, hasScoreEstimate } from '@/lib/scoreDisplay';
import {
  TEST_ROSTER_PAGE_SIZE,
  fetchTestParticipation,
  fetchTestRoster,
} from '@/lib/testStats';
import { getCategoryLabel, getTestCategory, getTestCollections } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import { formatDate } from '@/lib/formatDate';
import { courseTestsHref } from '@/components/admin/bank/links';
import { linkRowClass, rowLinkClass } from '@/components/admin/adminControls';
import { formatQuestionCount, formatTestLength } from '@/components/admin/testFacts';
import { renderQuestionPreview } from '@/app/admin/tests/questionPreview';
import { fetchQuestionAnswerStats, mergeQuestionStats } from './questionStats';
import { buttonClass } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { rowChevronClass, tableClass, tableWrapClass, tdClass, thClass } from '@/components/ui/List';
import { Progress, segmentClass, segmentedClass } from '@/components/ui/Misc';
import { BackLink, Page, PageHeader, SectionHeading } from '@/components/ui/Page';
import { Stat, StatGroup } from '@/components/ui/Stat';
import { cn } from '@/components/ui/cn';
import { ChevronLeft, ChevronRight, Edit3, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const numericThClass = cn(thClass, 'text-right');
const numericTdClass = cn(tdClass, 'text-right tabular-nums');

/**
 * A question is flagged as hard below this share of credit, once enough
 * attempts reached it for the share to mean something: one student missing
 * one question is not a finding.
 */
const HARD_QUESTION_RATE = 0.3;
const MIN_ATTEMPTS_TO_FLAG = 5;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/** A stored multi-select answer is "B,C"; it reads better spaced. */
function formatStoredAnswer(value: string) {
  return /^[A-H](,[A-H])+$/.test(value) ? value.split(',').join(', ') : value;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const parsed = Number(readParam(value));

  return Number.isFinite(parsed) && parsed > 1 ? Math.floor(parsed) : 1;
}

type QuestionOrder = 'hardest' | 'test';

/** One read per request, shared by the tab title and the page. */
const readStatsTest = cache((testId: string) => prisma.test.findUnique({
  where: { id: testId },
  select: {
    id: true,
    title: true,
    collectionCategory: true,
    durationSeconds: true,
    moduleDurations: true,
    // The paper, for the per-question table: its opening line and module only,
    // never the answer key. A copy is scored on its original's questions.
    questions: {
      orderBy: { order: 'asc' },
      select: { id: true, order: true, moduleIndex: true, content: true },
    },
    questionSource: {
      select: {
        questions: {
          orderBy: { order: 'asc' },
          select: { id: true, order: true, moduleIndex: true, content: true },
        },
      },
    },
  },
}));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>;
}): Promise<Metadata> {
  const { testId } = await params;
  // Same gate as the page: a hidden test's title is not for a student's tab.
  await requireAdminPage();
  const test = await readStatsTest(testId);

  return { title: test ? `${test.title} · stats` : 'Stats' };
}

export default async function AdminTestStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ page?: string | string[]; questions?: string | string[] }>;
}) {
  const [{ testId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const currentPage = parsePage(resolvedSearchParams?.page);
  const skip = (currentPage - 1) * TEST_ROSTER_PAGE_SIZE;
  const questionOrder: QuestionOrder = readParam(resolvedSearchParams?.questions) === 'test' ? 'test' : 'hardest';

  const test = await readStatsTest(testId);

  if (!test) {
    notFound();
  }

  const [collectionRows, participation, roster, totals, answerStats] = await Promise.all([
    getCollectionVisibilityRows(),
    fetchTestParticipation(test.id),
    fetchTestRoster(test.id, { take: TEST_ROSTER_PAGE_SIZE, skip }),
    prisma.result.aggregate({
      where: { testId: test.id },
      _avg: { score: true, timeSpent: true, correctCount: true },
      _max: { score: true, correctCount: true },
    }),
    fetchQuestionAnswerStats(test.id),
  ]);

  const collections = getTestCollections(collectionRows);
  const category = getTestCategory(test);
  const categoryLabel = category ? getCategoryLabel(category, collections) : 'Unassigned';
  const questions = getShownQuestions(test);
  const questionCount = questions.length;
  const modules = buildExamModules(test, questions);
  const moduleByQuestionId = new Map(
    modules.flatMap((module) => module.questions.map((question) => [question.id, module.index] as const))
  );

  // Under ten questions a 200-800 estimate is noise (scoreDisplay.ts): the
  // page then counts solved questions, as the course's Results tab does.
  const showScore = hasScoreEstimate(questionCount);
  const averageScore = Math.round(totals._avg.score ?? 0);
  const bestScore = totals._max.score ?? 0;
  const averageSolved = totals._avg.correctCount ?? 0;
  const bestSolved = totals._max.correctCount ?? 0;
  const averageTime = Math.round(totals._avg.timeSpent ?? 0);
  const averageAccuracy = questionCount > 0 ? averageSolved / questionCount : 0;
  const hasAttempts = participation.attempts > 0;

  const questionRows = questions.map((question) => {
    const stats = mergeQuestionStats(
      answerStats.get(question.id),
      answerStats.get(String(question.order - 1)),
    );

    return {
      ...question,
      ...stats,
      module: moduleByQuestionId.get(question.id) ?? 1,
      rate: stats.seen > 0 ? stats.credit / stats.seen : null,
    };
  });
  if (questionOrder === 'hardest') {
    // Never-reached questions (no rate) go last; ties keep the test's order.
    questionRows.sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2) || a.order - b.order);
  }

  const totalPages = Math.max(1, Math.ceil(participation.students / TEST_ROSTER_PAGE_SIZE));
  const statsHref = `/admin/tests/${test.id}/stats`;
  const buildStatsHref = (page: number, order: QuestionOrder) => {
    const query = new URLSearchParams();
    if (order === 'test') query.set('questions', 'test');
    if (page > 1) query.set('page', String(page));
    const search = query.toString();

    return search ? `${statsHref}?${search}` : statsHref;
  };

  return (
    <Page>
      <PageHeader
        back={
          category
            ? <BackLink href={courseTestsHref(category)}>Back to {categoryLabel}</BackLink>
            : <BackLink href="/admin/courses">Back to courses</BackLink>
        }
        // A title pasted without spaces must still wrap on a phone.
        title={<span className="wrap-anywhere">{test.title}</span>}
        description={`${categoryLabel} · ${formatQuestionCount(questionCount)} · ${formatTestLength(test)}`}
        actions={
          <Link
            href={`/admin/tests/${test.id}`}
            prefetch={false}
            className={buttonClass({ variant: 'secondary' })}
          >
            <Edit3 className="h-4 w-4" />
            Edit test
          </Link>
        }
      />

      {/* Best score and average time used to sit in the header and in a footnote
          under the roster; each now reads as the hint of the number it belongs to. */}
      <StatGroup>
        <Stat label="Students" value={String(participation.students)} />
        <Stat
          label="Attempts"
          value={String(participation.attempts)}
          hint={hasAttempts ? `${formatDuration(averageTime)} each on average` : undefined}
        />
        {/* A dash until someone has sat it: "0" and "0%" read as a result. */}
        {showScore ? (
          <Stat
            label="Average score"
            value={hasAttempts ? String(averageScore) : '—'}
            hint={hasAttempts ? `Best ${bestScore}` : undefined}
          />
        ) : (
          <Stat
            label="Average solved"
            value={hasAttempts ? formatCorrectOf(Math.round(averageSolved * 10) / 10, questionCount) : '—'}
            hint={hasAttempts ? `Best ${formatCorrectOf(bestSolved, questionCount)}` : undefined}
          />
        )}
        <Stat label="Average accuracy" value={hasAttempts ? formatPercent(averageAccuracy) : '—'} />
      </StatGroup>

      {/* What a teacher comes here for: which questions the group got wrong.
          Before the roster, which is about people rather than the paper. */}
      {hasAttempts && questionCount > 0 && (
        <section className="space-y-3">
          <SectionHeading
            title="Questions"
            description={`Share of attempts that got each question right. Below ${formatPercent(HARD_QUESTION_RATE)} is marked in red once ${MIN_ATTEMPTS_TO_FLAG} attempts have reached it.`}
            actions={
              // segmentedClass's gray-300 edge holds the track on the
              // gray-100 canvas; the old gray-200/70 fill was a tint outside
              // the scale.
              <nav aria-label="Question order" className={segmentedClass}>
                <Link
                  href={buildStatsHref(currentPage, 'hardest')}
                  prefetch={false}
                  aria-current={questionOrder === 'hardest' ? 'true' : undefined}
                  className={segmentClass(questionOrder === 'hardest')}
                >
                  Hardest first
                </Link>
                <Link
                  href={buildStatsHref(currentPage, 'test')}
                  prefetch={false}
                  aria-current={questionOrder === 'test' ? 'true' : undefined}
                  className={segmentClass(questionOrder === 'test')}
                >
                  Test order
                </Link>
              </nav>
            }
          />

          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={cn(thClass, 'w-12')}>#</th>
                  {modules.length > 1 && <th scope="col" className={thClass}>Module</th>}
                  <th scope="col" className={thClass}>Question</th>
                  <th scope="col" className={thClass}>Correct</th>
                  <th scope="col" className={numericThClass}>Not answered</th>
                  <th scope="col" className={thClass}>Most common wrong answer</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {questionRows.map((question) => {
                  const isHard = question.rate !== null
                    && question.rate < HARD_QUESTION_RATE
                    && question.seen >= MIN_ATTEMPTS_TO_FLAG;
                  const blank = question.seen - question.answered;

                  return (
                    <tr key={question.id}>
                      <td className={cn(tdClass, 'tabular-nums text-gray-500')}>{question.order}</td>
                      {modules.length > 1 && (
                        <td className={cn(tdClass, 'tabular-nums')}>{question.module}</td>
                      )}
                      <td className={tdClass}>
                        <div
                          className="line-clamp-1 min-w-48 max-w-md"
                          dangerouslySetInnerHTML={{
                            __html: renderQuestionPreview(question.content) || '<span class="text-gray-500">Image only</span>',
                          }}
                        />
                      </td>
                      <td className={tdClass}>
                        {question.rate === null ? (
                          <span className="text-gray-500">Not reached</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            {/* Red text only, and only for the very hard: a
                                column of red bars would read as failure everywhere. */}
                            <span
                              className={cn(
                                'w-10 shrink-0 text-right font-semibold tabular-nums',
                                isHard ? 'text-red-600' : 'text-gray-900',
                              )}
                            >
                              {formatPercent(question.rate)}
                            </span>
                            <div className="w-20 shrink-0">
                              <Progress value={Math.round(question.rate * 100)} tone="success" />
                            </div>
                            <span className="whitespace-nowrap text-xs tabular-nums text-gray-500">
                              of {question.seen}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={cn(numericTdClass, blank === 0 && 'text-gray-500')}>{blank}</td>
                      <td className={tdClass}>
                        {question.topWrong ? (
                          <span className="whitespace-nowrap">
                            {/* A grid-in answer can be long; the cut-off rest is in the tooltip. */}
                            <span
                              title={formatStoredAnswer(question.topWrong.answer)}
                              className="inline-block max-w-32 truncate align-bottom font-medium text-gray-900"
                            >
                              {formatStoredAnswer(question.topWrong.answer)}
                            </span>
                            <span className="tabular-nums text-gray-500"> · {question.topWrong.count}×</span>
                          </span>
                        ) : (
                          <span className="text-gray-500">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading
          title="Students"
          description={
            <>
              {participation.students > 0 && (
                <span className="tabular-nums">
                  Showing {roster.length ? skip + 1 : 0}&ndash;{skip + roster.length} of {participation.students}.{' '}
                </span>
              )}
              {showScore
                ? 'A student who retook the test is ranked on their best attempt, and the score and time beside a solved count come from that same attempt.'
                : 'A student who retook the test is ranked on their best attempt, and the time beside a solved count comes from that same attempt.'}
            </>
          }
        />

        {roster.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={participation.students > 0
              ? 'No students on this page'
              : 'Nobody has taken this test yet'}
            action={
              participation.students > 0 ? (
                <Link
                  href={buildStatsHref(1, questionOrder)}
                  prefetch={false}
                  className={buttonClass({ variant: 'secondary', size: 'sm' })}
                >
                  Go to the first page
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th scope="col" className={cn(thClass, 'w-12')}>#</th>
                  <th scope="col" className={thClass}>Student</th>
                  <th scope="col" className={thClass}>Solved</th>
                  {showScore && <th scope="col" className={numericThClass}>Score</th>}
                  <th scope="col" className={numericThClass}>Time</th>
                  <th scope="col" className={numericThClass}>Attempts</th>
                  <th scope="col" className={numericThClass}>Solved per attempt</th>
                  <th scope="col" className={numericThClass}>Last attempt</th>
                  <th scope="col" className={cn(thClass, 'w-10')}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {roster.map((student, index) => {
                  const rank = skip + index + 1;
                  const accuracy = questionCount > 0 ? student.bestCorrect / questionCount : 0;

                  return (
                    // The whole row opens the student (see `linkRowClass`).
                    <tr key={student.userId} className={cn(linkRowClass, 'group')}>
                      <td className={cn(tdClass, 'tabular-nums')}>
                        <span className="text-gray-500">{rank}</span>
                      </td>
                      <td className={tdClass}>
                        <div className="max-w-72">
                          <Link
                            href={`/admin/users/${student.userId}`}
                            prefetch={false}
                            className={cn(rowLinkClass, 'block truncate')}
                          >
                            {student.name || student.email}
                          </Link>
                          {student.name && <p className="truncate text-xs text-gray-500">{student.email}</p>}
                        </div>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-3">
                          <span className="whitespace-nowrap tabular-nums">
                            <span className="font-semibold text-gray-900">{formatCreditTotal(student.bestCorrect)}</span>
                            <span className="text-gray-500"> / {questionCount}</span>
                          </span>
                          {/* The same "correct" green the review pages use, so a
                              short bar reads as few solved questions. */}
                          <div className="w-20 shrink-0">
                            <Progress value={Math.round(accuracy * 100)} tone="success" />
                          </div>
                        </div>
                      </td>
                      {showScore && <td className={numericTdClass}>{student.bestScore}</td>}
                      <td className={cn(numericTdClass, 'whitespace-nowrap')}>
                        {formatDuration(student.bestTimeSpent)}
                      </td>
                      <td className={numericTdClass}>{student.attempts}</td>
                      <td className={numericTdClass}>
                        {/* testStats lists up to twelve counts; the width cap wraps
                            them instead of pushing the table into a sideways scroll. */}
                        {student.attempts > 1
                          ? <div className="ml-auto max-w-44">{student.correctCounts.map(formatCreditTotal).join(' / ')}</div>
                          : <span className="text-gray-500">&mdash;</span>}
                      </td>
                      <td className={cn(numericTdClass, 'whitespace-nowrap')}>
                        {student.latestAt ? formatDate(student.latestAt) : 'No attempts'}
                      </td>
                      <td className={tdClass}>
                        <ChevronRight aria-hidden className={rowChevronClass} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-between gap-3" aria-label="Roster pages">
            {currentPage > 1 ? (
              <Link
                href={buildStatsHref(currentPage - 1, questionOrder)}
                prefetch={false}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            ) : (
              <span />
            )}
            {/* On the gray-100 canvas, where gray-500 misses AA. */}
            <span className="text-xs tabular-nums text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link
                href={buildStatsHref(currentPage + 1, questionOrder)}
                prefetch={false}
                className={buttonClass({ variant: 'secondary', size: 'sm' })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </Page>
  );
}
