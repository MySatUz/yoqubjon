import React, { Suspense } from 'react';
import { auth } from "@/auth";
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { History, CheckCircle2 } from 'lucide-react';
import {
  sortCatalogTests,
  findCategoryByQuery,
  getTestCollections,
  type TestCategory,
} from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import PracticeCatalog from '@/components/dashboard/PracticeCatalog';
import { isAdminUser } from '@/lib/admin';
import { getActiveSectionAccessCategories } from '@/lib/sectionAccess';

/**
 * The shell (banners + "Recent Activity" heading + target card) depends only on
 * `searchParams`, so it is flushed immediately. The two data-bound regions sit
 * behind their own `<Suspense>` boundaries: the catalog must not wait for the
 * attempt history and vice versa.
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
  const requestedSet = searchParams.set;

  if (!session?.user?.id) {
    return <div>Unauthorized</div>;
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      {isSuccess && (
        <div className="mb-8 p-4 bg-emerald-500 text-white rounded-2xl font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6" />
            <span>Welcome to Premium! Your account has been upgraded.</span>
          </div>
          <Link href="/dashboard" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">Dismiss</Link>
        </div>
      )}
      {attemptLimitReached && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-800">
          The attempt limit for this test has been reached.
        </div>
      )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <Suspense fallback={<CatalogFallback />}>
            <PracticeCatalogSection
              userId={userId}
              userEmail={userEmail}
              requestedSet={requestedSet}
            />
          </Suspense>

          {/* Right Sidebar: Recent Activity */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Recent Activity
            </h2>

            <div className="space-y-4">
              <Suspense fallback={<RecentActivityFallback />}>
                <RecentActivity userId={userId} />
              </Suspense>
            </div>

            <div className="mt-8 p-6 bg-slate-900 rounded-2xl text-white">
              <div>
                <h3 className="font-semibold text-lg mb-2">Target Score: 800</h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-4">
                  Keep working through timed practice sets and review your latest attempts to reach your goal.
                </p>
                <Link
                  href="/dashboard/profile"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
                >
                  View Progress →
                </Link>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

async function PracticeCatalogSection({
  userId,
  userEmail,
  requestedSet,
}: {
  userId: string;
  userEmail?: string | null;
  requestedSet: string | string[] | undefined;
}) {
  const [attemptCounts, tests, subscription, canDownloadPdf, visibilityRows, sectionAccessCategories] = await Promise.all([
    prisma.result.groupBy({
      by: ['testId'],
      where: { userId },
      _count: { _all: true },
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
      },
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    }),
    isAdminUser(userId),
    getCollectionVisibilityRows(),
    getActiveSectionAccessCategories(userId, userEmail),
  ]);

  const isPremium = !!subscription;
  const attemptsUsedByTest = new Map(
    attemptCounts.map((attempt) => [attempt.testId, attempt._count._all])
  );
  const collections = getTestCollections(visibilityRows);
  const sectionAccessSet = new Set(sectionAccessCategories);
  const dashboardCollections = collections.map((collection) => (
    collection.visible || sectionAccessSet.has(collection.value) || canDownloadPdf
      ? { ...collection, visible: true }
      : collection
  ));
  const activeCategory: TestCategory | null = findCategoryByQuery(dashboardCollections, requestedSet);
  const visibleActiveCategory = activeCategory && dashboardCollections.some((collection) => (
    collection.value === activeCategory && collection.visible
  ))
    ? activeCategory
    : null;
  const sortedTests = sortCatalogTests(
    tests.filter((test) => canDownloadPdf || test.visible)
  );

  return (
    <PracticeCatalog
      initialCategory={visibleActiveCategory}
      tests={sortedTests.map((test) => ({
        ...test,
        attemptsUsed: attemptsUsedByTest.get(test.id) ?? 0,
        createdAt: test.createdAt.toISOString(),
        olympiadStartsAt: test.olympiadStartsAt?.toISOString() ?? null,
        olympiadEndsAt: test.olympiadEndsAt?.toISOString() ?? null,
      }))}
      collections={dashboardCollections}
      isPremium={isPremium}
      isAdmin={canDownloadPdf}
      accessibleCategories={sectionAccessCategories}
      canDownloadPdf={canDownloadPdf}
    />
  );
}

async function RecentActivity({ userId }: { userId: string }) {
  const results = await prisma.result.findMany({
    where: { userId },
    select: {
      id: true,
      testId: true,
      score: true,
      createdAt: true,
      test: {
        select: {
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  const seenTestIds = new Set<string>();
  const recentResults = results
    .filter((result) => {
      if (seenTestIds.has(result.testId)) return false;
      seenTestIds.add(result.testId);
      return true;
    })
    .slice(0, 5);

  if (recentResults.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
        <p className="text-slate-400 text-sm font-medium">No tests completed yet. Start your first practice!</p>
      </div>
    );
  }

  return (
    <>
      {recentResults.map((res) => (
        <Link
          key={res.id}
          href={`/dashboard/results/${res.id}`}
          className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
              {new Date(res.createdAt).toLocaleDateString()}
            </span>
            <span className="text-lg font-semibold text-blue-600 group-hover:scale-110 transition-transform">
              {res.score}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
            {res.test.title}
          </h4>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${(res.score / 800) * 100}%` }}
              ></div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </Link>
      ))}
    </>
  );
}

/**
 * Same geometry as the catalog column of `PageLoadingSkeleton variant="practice"`,
 * minus the page padding the shell already provides.
 */
function CatalogFallback() {
  return (
    <div className="lg:col-span-3">
      <header className="mb-10">
        <div className="h-10 w-72 max-w-full animate-pulse rounded-2xl bg-slate-200" />
        <div className="mt-3 h-6 w-[26rem] max-w-full animate-pulse rounded-full bg-slate-100" />
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}

/** Same card heights as the sidebar column of `PageLoadingSkeleton variant="practice"`. */
function RecentActivityFallback() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ))}
    </>
  );
}
