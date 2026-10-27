import { cache } from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { RotateCw, Trophy } from 'lucide-react';
import { auth } from '@/auth';
import { normalizeStoredAnswer } from '@/lib/resultAnswers';
import { buildExamModules } from '@/lib/examModules';
import { getShownQuestions } from '@/lib/questionSource';
import { formatDate } from '@/lib/formatDate';
import { formatDuration, formatReviewOpens, getReviewOpensAt, readOlympiadWindow } from '@/lib/olympiad';
import { getViewerAccess } from '@/lib/studentView';
import { getActiveSectionAccessCategories } from '@/lib/sectionAccess';
import { getTestCategory } from '@/lib/testCatalog';
import {
  MIN_QUESTIONS_FOR_SCORE,
  SAT_SCORE_MAX,
  SAT_SCORE_MIN,
  formatCorrectOf,
  formatScoreRange,
  hasScoreEstimate,
  likelyScoreRange,
  scorePercent,
} from '@/lib/scoreDisplay';
import { BackLink, Page, PageHeader } from '@/components/ui/Page';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { buttonClass, linkClass } from '@/components/ui/Button';
import { KeyValue } from '@/components/ui/Misc';
import { cn } from '@/components/ui/cn';
import ScoreDelta from '@/components/dashboard/ScoreDelta';
import ResultReview, {
  ClosedReview,
  ReviewMistakesButton,
  type ReviewModule,
  type ReviewStatus,
} from '@/components/dashboard/ResultReview';

const REVIEW_QUESTION_FIELDS = {
  id: true,
  order: true,
  correctAnswer: true,
  moduleIndex: true,
} as const;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const sumCredit = (answers: Array<{ credit: number }>) =>
  answers.reduce((total, answer) => total + answer.credit, 0);

function toStatus(isCorrect: boolean, credit: number, userAnswer: string): ReviewStatus {
  if (isCorrect) return 'correct';
  // "Ran out of time" and "got it wrong" call for different practice, so a
  // question left empty is its own status rather than another red chip.
  if (!userAnswer.trim()) return 'skipped';
  // Only a multi-select question can land here: it earned part of the mark, so
  // it is neither fully right nor fully wrong.
  return credit > 0 ? 'partial' : 'incorrect';
}

/**
 * The attempt, read once per request for both the page and its <title>.
 *
 * Question `content` and `imageUrl` are deliberately NOT selected. This page
 * renders no question text at all: the review below opens one question at a
 * time through `revealResultQuestion`, so the HTML a student receives never
 * contains a printable copy of the test.
 *
 * `moduleIndex` (question) and `durationSeconds`/`moduleDurations` (test) are
 * load-bearing — buildExamModules collapses every module into one without them.
 * `userId` is in the filter, not checked afterwards: somebody else's result
 * must be indistinguishable from one that does not exist.
 */
const getResult = cache((id: string, userId: string) =>
  prisma.result.findFirst({
    where: { id, userId },
    select: {
      testId: true,
      score: true,
      timeSpent: true,
      createdAt: true,
      answers: true,
      test: {
        select: {
          title: true,
          description: true,
          collectionCategory: true,
          durationSeconds: true,
          moduleDurations: true,
          // What the Retake button needs to know - the same gates the exam
          // page applies before it lets anyone in.
          isFree: true,
          visible: true,
          maxAttempts: true,
          olympiadStartsAt: true,
          olympiadEndsAt: true,
          // This student's attempts at the test, oldest first: which one this
          // is, the one before it to compare with, and how many are used.
          results: {
            where: { userId },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true, score: true, correctCount: true },
          },
          questions: {
            orderBy: { order: 'asc' },
            select: REVIEW_QUESTION_FIELDS,
          },
          // An attempt at a copy is reviewed against its original's questions.
          questionSource: {
            select: {
              questions: {
                orderBy: { order: 'asc' },
                select: REVIEW_QUESTION_FIELDS,
              },
            },
          },
        },
      },
    },
  })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  const result = session?.user?.id ? await getResult(id, session.user.id) : null;

  return { title: result ? `${result.test.title} result` : 'Result' };
}

export default async function ResultPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { review } = await searchParams;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  // The access reads do not depend on the result, so they run beside it.
  const [result, viewer, subscription, accessCategories] = await Promise.all([
    getResult(id, userId),
    getViewerAccess(userId),
    prisma.subscription.findFirst({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
    getActiveSectionAccessCategories(userId, session.user.email),
  ]);

  if (!result) notFound();

  const { test } = result;
  const userAnswers = result.answers as Record<string, unknown>;
  const modules = buildExamModules(test, getShownQuestions(test));
  const attempts = test.results;
  const attemptNumber = attempts.findIndex((attempt) => attempt.id === id) + 1;
  const previous = attemptNumber > 1 ? attempts[attemptNumber - 2] : null;

  // Grading happens here, on the server, and only the verdict crosses to the
  // client — never the answer key it was graded against.
  const reviewModules: ReviewModule[] = modules.map((module) => ({
    index: module.index,
    // Numbered inside the module, the way the exam screen numbers them.
    questions: module.questions.map((q, index) => {
      const answer = normalizeStoredAnswer(
        userAnswers[q.id] ?? userAnswers[(q.order - 1).toString()],
        q.correctAnswer
      );

      return {
        id: q.id,
        number: index + 1,
        moduleIndex: module.index,
        status: toStatus(answer.isCorrect, answer.credit, answer.userAnswer),
        credit: answer.credit,
      };
    }),
  }));

  const answers = reviewModules.flatMap((module) => module.questions);
  const totalCount = answers.length;
  // Credit, not a count of right answers: a multi-select question can be partly
  // right.
  const earnedCredit = sumCredit(answers);
  const countOf = (status: ReviewStatus) => answers.filter((answer) => answer.status === status).length;
  const mistakeCount = totalCount - countOf('correct');
  const hasScore = hasScoreEstimate(totalCount);

  // Retake: the exam page's own gates, so the button never leads to a
  // redirect. An olympiad goes through its page instead - the window and the
  // ranking live there. An admin in student view is not an admin here.
  const olympiad = readOlympiadWindow(test);
  // An olympiad that has not ended keeps its questions closed - and with them
  // which answers were right, which would give a second attempt the key. The
  // counts above stay: they are the student's own total, as the ranking is.
  const reviewOpensAt = viewer.isAdmin ? null : getReviewOpensAt(test);
  const reviewOpens = reviewOpensAt ? formatReviewOpens(reviewOpensAt) : null;
  const category = getTestCategory(test);
  const canAccess =
    test.isFree ||
    Boolean(subscription) ||
    viewer.simulatesSubscription ||
    Boolean(category && accessCategories.includes(category));
  const attemptsLeft = viewer.isAdmin ? null : test.maxAttempts - attempts.length;
  const canRetake =
    !olympiad && (viewer.isAdmin || (test.visible && canAccess && attemptsLeft !== null && attemptsLeft > 0));

  return (
    <Page>
      <PageHeader
        back={<BackLink href="/dashboard/results">Back to results</BackLink>}
        title={test.title}
        description={
          <>
            Completed {formatDate(result.createdAt)}
            {attempts.length > 1 && attemptNumber > 0 && (
              <>
                {' · '}
                <span className="tabular-nums">Attempt {attemptNumber} of {attempts.length}</span>
                {' · '}
                <Link href={`/dashboard/results?test=${encodeURIComponent(result.testId)}`} className={linkClass}>
                  See all attempts
                </Link>
              </>
            )}
          </>
        }
      />

      {/* A container: the hero puts the scale beside the score once the card,
          not the viewport, is wide enough - the sidebar takes 80-240px of it. */}
      <Card as="section" aria-labelledby="score-heading" className="@container">
        {hasScore ? (
          <ScoreHero
            score={result.score}
            range={likelyScoreRange(earnedCredit, totalCount, result.score)}
            questionCount={totalCount}
            previous={previous ? { number: attemptNumber - 1, value: previous.score } : null}
          />
        ) : (
          <CountHero
            correct={earnedCredit}
            questionCount={totalCount}
            previous={
              previous && previous.correctCount !== null
                ? { number: attemptNumber - 1, value: previous.correctCount }
                : null
            }
          />
        )}

        {/* Each fact once: the old row said the same fraction three times
            (accuracy, correct, incorrect) and counted an empty answer as a
            wrong one. */}
        <dl
          className={cn(
            'grid gap-4 border-t border-gray-100 px-5 py-4',
            hasScore ? 'grid-cols-2 @lg:grid-cols-4' : 'grid-cols-3'
          )}
        >
          {/* A short check already says "2 of 3 correct" in big type above. */}
          {hasScore && (
            <KeyValue label="Correct" value={<span className="tabular-nums">{formatCorrectOf(earnedCredit, totalCount)}</span>} />
          )}
          <KeyValue label="Incorrect" value={<span className="tabular-nums">{countOf('incorrect')}</span>} />
          <KeyValue label="Not answered" value={<span className="tabular-nums">{countOf('skipped')}</span>} />
          <KeyValue label="Time" value={<span className="tabular-nums">{formatDuration(result.timeSpent)}</span>} />
        </dl>

        {/* A two-module test says how each module went: on the SAT the first
            decides the second, so the split is worth seeing. A one-block test
            has one count, and the row above already gives it. */}
        {reviewModules.length > 1 && (
          <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 px-5 py-4 @lg:grid-cols-4">
            {reviewModules.map((module) => (
              <KeyValue
                key={module.index}
                label={`Module ${module.index}`}
                value={
                  <span className="tabular-nums">
                    {formatCorrectOf(sumCredit(module.questions), module.questions.length)} correct
                  </span>
                }
              />
            ))}
          </dl>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-4">
          <p className="min-w-0 flex-1 basis-64 text-sm text-gray-600">
            {reviewOpens
              ? reviewOpens
              : mistakeCount === 0
                ? 'Every answer is right.'
                : canRetake
                  ? `Go over your ${mistakeCount} ${mistakeCount === 1 ? 'mistake' : 'mistakes'}, then retake the test while it is fresh.`
                  : `Go over your ${mistakeCount} ${mistakeCount === 1 ? 'mistake' : 'mistakes'}, one question at a time.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {mistakeCount > 0 && !reviewOpens && <ReviewMistakesButton resultId={id} count={mistakeCount} />}
            {canRetake && (
              <Link
                href={`/exam/${result.testId}`}
                className={buttonClass({ variant: mistakeCount > 0 ? 'secondary' : 'primary' })}
              >
                <RotateCw className="h-4 w-4" />
                Retake test
                {attemptsLeft !== null && <span className="tabular-nums">· {attemptsLeft} left</span>}
              </Link>
            )}
            {olympiad && (
              <Link href={`/olympiad/${result.testId}`} className={buttonClass({ variant: 'secondary' })}>
                <Trophy className="h-4 w-4" />
                Olympiad ranking
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Remounted when the URL asks for another filter. Closed, the chips
          are not sent at all: their right/wrong marks are the key. */}
      {reviewOpens ? (
        <ClosedReview opens={reviewOpens} />
      ) : (
        <ResultReview
          key={review === 'mistakes' ? 'mistakes' : 'all'}
          resultId={id}
          testTitle={test.title}
          modules={reviewModules}
          initialFilter={review === 'mistakes' ? 'mistakes' : 'all'}
        />
      )}

      {/* The only thing a printed copy of this page says about the questions.
          The review itself is never in the print output because it is never
          fully in the page to begin with. */}
      {!reviewOpens && (
        <p className="hidden text-sm text-gray-500 print:block">
          The question-by-question review is only available on screen.
        </p>
      )}
    </Page>
  );
}

type Previous = { number: number; value: number } | null;

/**
 * The score as the one big number of the page, on the 200-800 scale with the
 * band it is likely to fall in and the attempt before it. Never without the
 * word "estimate": it is a conversion of practice answers, not a College
 * Board score, and the band says how far to trust it.
 */
function ScoreHero({
  score,
  range,
  questionCount,
  previous,
}: {
  score: number;
  range: { low: number; high: number };
  questionCount: number;
  previous: Previous;
}) {
  const low = scorePercent(range.low);
  const scaleLabel =
    `Score ${score} on a scale from ${SAT_SCORE_MIN} to ${SAT_SCORE_MAX}, ` +
    `likely between ${range.low} and ${range.high}` +
    (previous ? `. Attempt ${previous.number} scored ${previous.value}.` : '.');

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-5 p-5 @2xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] @2xl:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 id="score-heading" className="text-xs font-medium text-gray-500">
            SAT Math score
          </h2>
          <Badge>Estimate</Badge>
        </div>
        <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-gray-900 sm:text-5xl">
          {score}
          <span className="text-lg font-medium tracking-normal text-gray-500"> / {SAT_SCORE_MAX}</span>
        </p>
        {previous && (
          <div className="mt-2">
            <ScoreDelta
              delta={score - previous.value}
              context={`since attempt ${previous.number}`}
              same={`Same as attempt ${previous.number}`}
            />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div role="img" aria-label={scaleLabel} className="relative h-2 rounded-full bg-gray-100">
          <span
            className="absolute inset-y-0 rounded-full bg-gray-300"
            style={{ left: `${low}%`, width: `${scorePercent(range.high) - low}%` }}
          />
          {previous && (
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-500 bg-white"
              style={{ left: `${scorePercent(previous.value)}%` }}
            />
          )}
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink-600"
            style={{ left: `${scorePercent(score)}%` }}
          />
        </div>
        <div aria-hidden className="mt-1.5 flex justify-between text-xs tabular-nums text-gray-500">
          <span>{SAT_SCORE_MIN}</span>
          <span>{SAT_SCORE_MAX}</span>
        </div>
        <ul aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="tabular-nums">This attempt {score}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-gray-300" />
            <span className="tabular-nums">Likely {formatScoreRange(range)}</span>
          </li>
          {previous && (
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-gray-500 bg-white" />
              <span className="tabular-nums">
                Attempt {previous.number} {previous.value}
              </span>
            </li>
          )}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          An estimate from {questionCount} questions, not an official College Board score.
        </p>
      </div>
    </div>
  );
}

/**
 * A check too short for a score: on three questions one answer moves the
 * 200-800 scale by 200 points. The count is the honest headline.
 */
function CountHero({
  correct,
  questionCount,
  previous,
}: {
  correct: number;
  questionCount: number;
  previous: Previous;
}) {
  return (
    <div className="p-5">
      <h2 id="score-heading" className="text-xs font-medium text-gray-500">
        Your result
      </h2>
      <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-gray-900 sm:text-5xl">
        {formatCorrectOf(correct, questionCount)}
        <span className="text-lg font-medium tracking-normal text-gray-500"> correct</span>
      </p>
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', previous ? 'mt-2' : 'mt-1')}>
        {previous && (
          <ScoreDelta
            delta={correct - previous.value}
            unit="correct"
            context={`since attempt ${previous.number}`}
            same={`Same as attempt ${previous.number}`}
          />
        )}
        <p className="text-xs text-gray-500">
          No score estimate: it takes at least {MIN_QUESTIONS_FOR_SCORE} questions to be worth one.
        </p>
      </div>
    </div>
  );
}
