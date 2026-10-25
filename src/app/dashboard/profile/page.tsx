import { cache, Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChartNoAxesColumn, ChevronRight, Play } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatDate";
import { formatDuration } from "@/lib/olympiad";
import { MIN_QUESTIONS_FOR_SCORE, hasScoreEstimate } from "@/lib/scoreDisplay";
import { buildCollectionProgress } from "@/lib/courseProgress";
import { getCollectionVisibilityRows } from "@/lib/testCollections";
import { getActiveSectionAccessCategories } from "@/lib/sectionAccess";
import { getViewerAccess } from "@/lib/studentView";
import { FREE_PLAN, PREMIUM_PLAN, PREMIUM_PLAN_ID } from "@/lib/plans";
import { readSalesOpen } from "@/app/dashboard/salesOpen";
import { getCategoryQueryValue, getTestCategory, getTestCollections } from "@/lib/testCatalog";
import { Page, PageHeader } from "@/components/ui/Page";
import { Card, CardHeader, cardClass } from "@/components/ui/Card";
import { Stat, StatGroup } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { Avatar, Progress } from "@/components/ui/Misc";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import { listRowClass, listRowInteractiveClass, rowChevronClass } from "@/components/ui/List";
import { cn } from "@/components/ui/cn";
import NameForm from "@/app/dashboard/profile/NameForm";

export const metadata: Metadata = { title: "Profile" };

/*
 * Every read is memoized per request with React `cache()`, so the regions
 * below that share one - the name, the progress - cost one Prisma call
 * between them. The attempt-by-attempt history lives only in Results.
 */
const getActiveSubscription = cache((userId: string) =>
  prisma.subscription.findFirst({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  })
);

/** From the database, not the session: the session keeps the name it was signed in with. */
const getUserName = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name?.trim() || null;
});

/**
 * The numbers on this page. Scores count attempts at tests of 10 or more
 * questions only: a three-question check scores 200 or 800 on one answer, and
 * averaged in it dragged a student's 600s down to "378".
 */
const getProgress = cache(async (userId: string, email: string | null | undefined) => {
  const [results, tests, collectionRows, accessCategories, viewer] = await Promise.all([
    // Light rows, newest first: every attempt counts, and even a heavy user has a few hundred.
    prisma.result.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { testId: true, score: true, timeSpent: true },
    }),
    prisma.test.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        collectionCategory: true,
        visible: true,
        _count: { select: { questions: true } },
        // A copy shows its original's questions and has none of its own.
        questionSource: { select: { _count: { select: { questions: true } } } },
      },
    }),
    getCollectionVisibilityRows(),
    getActiveSectionAccessCategories(userId, email),
    getViewerAccess(userId),
  ]);

  const testById = new Map(
    tests.map((test) => [
      test.id,
      {
        title: test.title,
        visible: test.visible,
        category: getTestCategory(test),
        questionCount: test.questionSource?._count.questions ?? test._count.questions,
      },
    ])
  );
  const scored = results.filter((result) => hasScoreEstimate(testById.get(result.testId)?.questionCount ?? 0));
  // Newest first, so a best reached twice is credited to the latest test.
  const best = scored.reduce<(typeof scored)[number] | null>(
    (top, result) => (!top || result.score > top.score ? result : top),
    null
  );

  // Collections as the catalog shows them to this student: the link back to
  // one only where the catalog would open it.
  const accessSet = new Set(accessCategories);
  const collections = getTestCollections(collectionRows);
  const openable = new Set(
    collections
      .filter((collection) => collection.visible || accessSet.has(collection.value) || viewer.isAdmin)
      .map((collection) => collection.value)
  );
  const byCollection = buildCollectionProgress({
    collections,
    tests: tests
      .filter((test) => test.visible || viewer.isAdmin)
      .map((test) => ({ id: test.id, ...testById.get(test.id)! })),
    results,
  }).map((progress) => ({
    ...progress,
    href: openable.has(progress.category) ? `/dashboard?set=${encodeURIComponent(getCategoryQueryValue(progress.category))}` : null,
  }));

  return {
    attempts: results.length,
    testsCompleted: new Set(results.map((result) => result.testId)).size,
    totalSeconds: results.reduce((total, result) => total + result.timeSpent, 0),
    scoredAttempts: scored.length,
    average:
      scored.length > 0 ? Math.round(scored.reduce((total, result) => total + result.score, 0) / scored.length) : null,
    best: best ? { score: best.score, title: testById.get(best.testId)?.title ?? null } : null,
    byCollection,
  };
});

/**
 * `auth()` and the "Unauthorized" branch stay above every boundary: after a
 * fallback is flushed the HTTP status can no longer change (`loading.md`,
 * "Status Codes"). Everything below streams in independently.
 */
export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) return <div>Unauthorized</div>;

  const userId = session.user.id;
  const email = session.user.email;

  return (
    <Page>
      <PageHeader
        title="Profile"
        description="Your account, your plan and how your practice is going. Every attempt is in Results."
      />

      <Suspense fallback={<ProfileCardFallback />}>
        <ProfileCard userId={userId} sessionName={session.user.name} email={email} />
      </Suspense>

      <Suspense fallback={<StatsFallback />}>
        <Stats userId={userId} email={email} />
      </Suspense>

      {/* items-start: the name card keeps its own height beside a long list. */}
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Suspense fallback={<CollectionsFallback />}>
            <CollectionsCard userId={userId} email={email} />
          </Suspense>

          <Card as="section" aria-labelledby="name-heading">
            <CardHeader
              title={<span id="name-heading">Your name</span>}
              description="Shown on olympiad rankings. Practice results stay private."
            />
            <Suspense fallback={<NameFormFallback />}>
              <NameSection userId={userId} sessionName={session.user.name} />
            </Suspense>
          </Card>
        </div>
      </div>
    </Page>
  );
}

/**
 * The account in one row: who you are and which plan you are on. The plan used
 * to be shown twice — a pill here and a dark banner at the bottom of the page —
 * and the name and email twice more in tiles under the hero.
 */
async function ProfileCard({
  userId,
  sessionName,
  email,
}: {
  userId: string;
  sessionName?: string | null;
  email?: string | null;
}) {
  const [subscription, name, salesOpen] = await Promise.all([
    getActiveSubscription(userId),
    getUserName(userId),
    readSalesOpen("Profile"),
  ]);
  const isPremium = subscription?.planId === PREMIUM_PLAN_ID;
  // "MYSAT Student" was neither the brand (MYSATuz) nor a name.
  const displayName = name || sessionName || "Student";

  return (
    <Card as="section" className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={displayName} size="lg" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold text-mist-900">{displayName}</h2>
            <Badge tone={isPremium ? "success" : "neutral"}>{isPremium ? PREMIUM_PLAN.name : FREE_PLAN.name}</Badge>
          </div>
          <p className="mt-0.5 truncate text-sm text-mist-500">{email}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
        <p className="text-sm text-mist-500">
          {isPremium && subscription
            ? `Active until ${formatDate(subscription.expiresAt)}`
            : salesOpen
              ? "Upgrade when you are ready for full access."
              : // Paused by an admin: no nudge towards a plan nobody can buy.
                "The tests marked Free are open to you."}
        </p>
        {/* A free account has no subscription to manage: it looks at plans. */}
        <Link href="/dashboard/subscription" className={buttonClass({ variant: "secondary", size: "sm" })}>
          {isPremium ? "Manage subscription" : "See plans"}
        </Link>
      </div>
    </Card>
  );
}

/**
 * Tests and attempts are separate numbers: "Tests taken 44" used to count
 * attempts. A new student gets one next step instead of a row of zeros.
 */
async function Stats({ userId, email }: { userId: string; email?: string | null }) {
  const progress = await getProgress(userId, email);

  if (progress.attempts === 0) {
    return (
      <EmptyState
        icon={<ChartNoAxesColumn />}
        title="No tests finished yet"
        description="Your scores and your progress by course appear here after your first test."
        action={
          <Link href="/dashboard" className={buttonClass()}>
            <Play className="h-4 w-4" />
            Start a test
          </Link>
        }
      />
    );
  }

  // "Full test" is the word for a test long enough to score: shorter checks
  // count as attempts but stay out of the two scores.
  const fullTestsHint = `Full tests only (${MIN_QUESTIONS_FOR_SCORE}+ questions)`;

  return (
    <StatGroup>
      <Stat
        label="Average score"
        value={progress.average ?? "—"}
        hint={
          progress.average === null
            ? fullTestsHint
            : `Over ${progress.scoredAttempts} full-test ${progress.scoredAttempts === 1 ? "attempt" : "attempts"}`
        }
      />
      <Stat label="Best score" value={progress.best?.score ?? "—"} hint={progress.best?.title ?? fullTestsHint} />
      <Stat label="Tests completed" value={progress.testsCompleted} />
      <Stat label="Attempts" value={progress.attempts} />
      <Stat label="Practice time" value={formatDuration(progress.totalSeconds)} />
    </StatGroup>
  );
}

/** Where the student stands in each course they have practised in. */
async function CollectionsCard({ userId, email }: { userId: string; email?: string | null }) {
  const { byCollection } = await getProgress(userId, email);
  if (byCollection.length === 0) return null;

  return (
    <Card as="section">
      <CardHeader title="Progress by course" description="Tests finished at least once, and your best full-test score." />
      <ul className="divide-y divide-mist-100">
        {byCollection.map((collection) => {
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium text-mist-900">{collection.label}</p>
                  <span className="shrink-0 text-xs tabular-nums text-mist-500">
                    {collection.testsDone} of {collection.testsTotal} {collection.testsTotal === 1 ? "test" : "tests"}
                  </span>
                </div>
                <Progress
                  className="mt-2"
                  value={collection.testsTotal > 0 ? (collection.testsDone / collection.testsTotal) * 100 : 0}
                />
              </div>
              <div className="w-20 shrink-0 text-right">
                {collection.best !== null ? (
                  <>
                    <p className="text-sm font-semibold tabular-nums text-mist-900">{collection.best}</p>
                    <p className="text-xs text-mist-500">best</p>
                  </>
                ) : (
                  <p className="text-xs text-mist-500">No score yet</p>
                )}
              </div>
            </>
          );

          return (
            <li key={collection.category}>
              {collection.href ? (
                <Link href={collection.href} className={cn(listRowInteractiveClass, "group")}>
                  {body}
                  <ChevronRight className={rowChevronClass} />
                </Link>
              ) : (
                // A collection no longer open to this student: its history
                // stays, the way into it does not.
                <div className={listRowClass}>
                  {body}
                  <span className="w-4 shrink-0" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

async function NameSection({ userId, sessionName }: { userId: string; sessionName?: string | null }) {
  const name = await getUserName(userId);
  return <NameForm name={name ?? sessionName ?? ""} />;
}

/*
 * Fallbacks mirror the regions above block by block, so nothing jumps when a
 * region streams in. loading.tsx draws the same shapes for the first paint.
 */

function ProfileCardFallback() {
  return (
    <div className={cn(cardClass, "flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-mist-200/70" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-40 pointer-coarse:h-10" />
    </div>
  );
}

function StatsFallback() {
  return (
    <StatGroup>
      {[0, 1, 2, 3, 4].map((i) => (
        // Same geometry as <Stat> with a hint: a 16px label line, a 28px (32px
        // from sm) value, a 16px hint line.
        <div key={i} className="bg-white px-4 py-3.5 sm:px-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-1 h-7 w-16 sm:h-8" />
          <Skeleton className="mt-0.5 h-4 w-28 max-w-full" />
        </div>
      ))}
    </StatGroup>
  );
}

function CollectionsFallback() {
  return (
    <div className={cardClass}>
      <div className="space-y-1.5 border-b border-mist-100 px-5 py-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="divide-y divide-mist-100">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-1.5 w-full" />
            </div>
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NameFormFallback() {
  return (
    <div className="space-y-4 p-5">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-9 w-full pointer-coarse:h-11" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-9 w-28 pointer-coarse:h-11" />
    </div>
  );
}
