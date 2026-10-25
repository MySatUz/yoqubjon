import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { auth } from "@/auth";
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { sortCatalogTests, getTestCategory, getTestCollections } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import PracticeCatalog from '@/components/dashboard/PracticeCatalog';
import { getViewerAccess } from '@/lib/studentView';
import { getActiveSectionAccessGrants } from '@/lib/sectionAccess';
import {
  buildPracticeOverview,
  countMistakes,
  getLastResultIds,
  type LastResultReview,
} from '@/lib/courseProgress';
import { getShownQuestions } from '@/lib/questionSource';
import { getReviewOpensAt } from '@/lib/olympiad';
import { PREMIUM_PLAN } from '@/lib/plans';
import { readSalesOpen } from '@/app/dashboard/salesOpen';
import CourseOverview from '@/components/dashboard/CourseOverview';
import PracticeHomeSkeleton from '@/components/dashboard/PracticeHomeSkeleton';
import { Page } from '@/components/ui/Page';
import { Alert } from '@/components/ui/Feedback';
import { buttonClass } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Practice' };

/**
 * The notices depend only on `searchParams`, so they are flushed immediately;
 * the catalog sits behind its own `<Suspense>` boundary.
 *
 * `auth()` and the "Unauthorized" branch stay ABOVE every boundary on purpose —
 * once a fallback renders, the response headers are already sent and the status
 * code can no longer change (see `loading.md`, "Status Codes").
 */
export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const isSuccess = searchParams.payment === 'success';
  const attemptLimitReached = searchParams.attemptLimit === 'reached';
  const limitedTestId = typeof searchParams.test === 'string' ? searchParams.test : null;

  if (!session?.user?.id) {
    return <div>Unauthorized</div>;
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  return (
    <Page>
      {isSuccess && (
        <Alert
          tone="success"
          title={`${PREMIUM_PLAN.name} is active`}
          action={
            // Outlined, like every alert action: bare text beside the message
            // did not read as something to press.
            <Link href="/dashboard" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Dismiss
            </Link>
          }
        >
          Every Premium test is open to you now.
        </Alert>
      )}
      {attemptLimitReached && (
        <Alert
          action={
            // Every attempt stays reviewable, so point at them.
            <Link
              href={limitedTestId ? `/dashboard/results?test=${encodeURIComponent(limitedTestId)}` : '/dashboard/results'}
              className={buttonClass({ variant: 'secondary', size: 'sm' })}
            >
              Review your attempts
            </Link>
          }
        >
          You have used every attempt at this test.
        </Alert>
      )}

      <Suspense fallback={<PracticeHomeSkeleton />}>
        {/* The open collection (`?set=`) is read by the catalog itself, from
            the URL, so a switch between collections never waits on this. */}
        <PracticeCatalogSection userId={userId} userEmail={userEmail} />
      </Suspense>
    </Page>
  );
}

const REVIEW_QUESTION_FIELDS = { id: true, order: true, correctAnswer: true } as const;

/**
 * Mistakes and whether the review is open, for the course cards' last
 * results. The keys are read here, on the server, and only the count leaves
 * it. A failed read costs the cards their count ("Open the review"), not the
 * whole Practice page.
 */
async function readLastResultReviews(
  userId: string,
  resultIds: string[],
  isAdmin: boolean
): Promise<Map<string, LastResultReview>> {
  if (resultIds.length === 0) return new Map();

  try {
    const rows = await prisma.result.findMany({
      where: { id: { in: resultIds }, userId },
      select: {
        id: true,
        answers: true,
        test: {
          select: {
            olympiadStartsAt: true,
            olympiadEndsAt: true,
            questions: { select: REVIEW_QUESTION_FIELDS },
            // An attempt at a copy is graded against its original's questions.
            questionSource: { select: { questions: { select: REVIEW_QUESTION_FIELDS } } },
          },
        },
      },
    });

    return new Map(
      rows.map((row) => [
        row.id,
        {
          mistakes: countMistakes(getShownQuestions(row.test), row.answers),
          closed: !isAdmin && getReviewOpensAt(row.test) !== null,
        },
      ])
    );
  } catch (error) {
    console.error('Practice: could not read the last results for the course cards', error);
    return new Map();
  }
}

async function PracticeCatalogSection({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail?: string | null;
}) {
  const [attemptCounts, tests, subscription, viewer, visibilityRows, sectionAccessGrants, recentResults, questionCounts, salesOpen] = await Promise.all([
    // The best attempt rides along for the card's "Best 600".
    prisma.result.groupBy({
      by: ['testId'],
      where: { userId },
      _count: { _all: true },
      _max: { score: true, correctCount: true },
    }),
    prisma.test.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        collectionCategory: true,
        durationSeconds: true,
        moduleDurations: true,
        maxAttempts: true,
        isFree: true,
        visible: true,
        createdAt: true,
        olympiadStartsAt: true,
        olympiadEndsAt: true,
        questionSourceId: true,
      },
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    }),
    getViewerAccess(userId),
    getCollectionVisibilityRows(),
    getActiveSectionAccessGrants(userId, userEmail),
    // For the course cards: newest first, enough to cover a 1-3 month course.
    prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, testId: true, score: true, correctCount: true, createdAt: true },
    }),
    // Question counts decide which results are full-length enough to plot.
    prisma.question.groupBy({ by: ['testId'], _count: { _all: true } }),
    // While an admin has paused sales, a locked card must not offer an unlock
    // that ends on a page with nothing to buy.
    readSalesOpen('Practice'),
  ]);
  const sectionAccessCategories = sectionAccessGrants.map((grant) => grant.category);

  // An admin in student view gets the student's catalog: no hidden tests or
  // sections, no PDF button, the usual attempt counts.
  const canDownloadPdf = viewer.isAdmin;
  const isPremium = !!subscription || viewer.simulatesSubscription;
  const attemptsUsedByTest = new Map(
    attemptCounts.map((attempt) => [attempt.testId, attempt._count._all])
  );
  // The highest score and the most answers right come from the same attempt:
  // on one test the score follows the count of right answers.
  const bestByTest = new Map(
    attemptCounts.map((attempt) => [
      attempt.testId,
      attempt._max.score === null ? null : { score: attempt._max.score, correct: attempt._max.correctCount },
    ])
  );
  const collections = getTestCollections(visibilityRows);
  const sectionAccessSet = new Set(sectionAccessCategories);
  const dashboardCollections = collections.map((collection) => (
    collection.visible || sectionAccessSet.has(collection.value) || canDownloadPdf
      ? { ...collection, visible: true }
      : collection
  ));
  const sortedTests = sortCatalogTests(
    tests.filter((test) => canDownloadPdf || test.visible)
  );

  // A copy shows its original's questions, so it counts them too.
  const ownQuestionCount = new Map(questionCounts.map((row) => [row.testId, row._count._all]));
  const visibleCollectionsForOverview = dashboardCollections.filter((collection) => collection.visible);
  const overviewInput = {
    collections: visibleCollectionsForOverview,
    tests: sortedTests.map((test) => {
      const category = getTestCategory(test);
      return {
        id: test.id,
        title: test.title,
        category,
        attemptsUsed: attemptsUsedByTest.get(test.id) ?? 0,
        maxAttempts: canDownloadPdf ? Number.POSITIVE_INFINITY : test.maxAttempts,
        questionCount: ownQuestionCount.get(test.questionSourceId ?? test.id) ?? 0,
        canAccess: canDownloadPdf || test.isFree || isPremium || Boolean(category && sectionAccessCategories.includes(category)),
        isFree: test.isFree,
        isOlympiad: test.olympiadStartsAt !== null,
        durationSeconds: test.durationSeconds,
        moduleDurations: test.moduleDurations,
      };
    }),
    results: recentResults,
    grants: sectionAccessGrants,
  };
  // The cards' "Review N questions" counts as the result page does, so it
  // needs the answers of the one last result per card - two rows at most.
  const reviews = await readLastResultReviews(userId, getLastResultIds(overviewInput), viewer.isAdmin);
  const overview = buildPracticeOverview({ ...overviewInput, reviews });

  return (
    <PracticeCatalog
      tests={sortedTests.map((test) => ({
        ...test,
        attemptsUsed: attemptsUsedByTest.get(test.id) ?? 0,
        questionCount: ownQuestionCount.get(test.questionSourceId ?? test.id) ?? 0,
        best: bestByTest.get(test.id) ?? null,
        createdAt: test.createdAt.toISOString(),
        olympiadStartsAt: test.olympiadStartsAt?.toISOString() ?? null,
        olympiadEndsAt: test.olympiadEndsAt?.toISOString() ?? null,
      }))}
      collections={dashboardCollections}
      isPremium={isPremium}
      salesOpen={salesOpen}
      isAdmin={canDownloadPdf}
      accessibleCategories={sectionAccessCategories}
      canDownloadPdf={canDownloadPdf}
      overview={
        overview.courses.length > 0 || overview.startHere ? (
          <CourseOverview overview={overview} userId={userId} />
        ) : null
      }
      // A new student has nothing to pick up yet: their card is "Start here".
      description={
        overview.courses.length > 0
          ? 'Pick up where you left off, or open any course below.'
          : overview.startHere
            ? 'Start with the test below, or open any course.'
            : undefined
      }
    />
  );
}
