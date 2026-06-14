import React from 'react';
import { auth } from "@/auth";
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { History, CheckCircle2 } from 'lucide-react';
import {
  compareCatalogTests,
  findCategoryByQuery,
  getTestCollections,
  type TestCategory,
} from '@/lib/testCatalog';
import PracticeCatalog from '@/components/dashboard/PracticeCatalog';
import { isAdminUser } from '@/lib/admin';
import { getActiveSectionAccessCategories } from '@/lib/sectionAccess';

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const isSuccess = searchParams.payment === 'success';
  const requestedSet = searchParams.set;
  
  if (!session?.user?.id) {
    return <div>Unauthorized</div>;
  }

  // Fetch data in parallel
  const [results, tests, subscription, canDownloadPdf, visibilityRows, sectionAccessCategories] = await Promise.all([
    prisma.result.findMany({
      where: { userId: session.user.id },
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
    }),
    prisma.test.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        collectionCategory: true,
        durationSeconds: true,
        isFree: true,
        createdAt: true,
      },
    }),
    prisma.subscription.findFirst({
      where: { 
        userId: session.user.id,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    }),
    isAdminUser(session.user.id),
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
      },
    }),
    getActiveSectionAccessCategories(session.user.id, session.user.email),
  ]);

  const isPremium = !!subscription;
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
  const sortedTests = [...tests].sort(compareCatalogTests);
  const seenTestIds = new Set<string>();
  const recentResults = results
    .filter((result) => {
      if (seenTestIds.has(result.testId)) return false;
      seenTestIds.add(result.testId);
      return true;
    })
    .slice(0, 5);

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      {isSuccess && (
        <div className="mb-8 p-4 bg-green-500 text-white rounded-2xl font-black flex items-center justify-between shadow-lg shadow-green-200 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6" />
            <span>Welcome to Premium! Your account has been upgraded.</span>
          </div>
          <Link href="/dashboard" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">Dismiss</Link>
        </div>
      )}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <PracticeCatalog
            initialCategory={visibleActiveCategory}
            tests={sortedTests.map((test) => ({
              ...test,
              createdAt: test.createdAt.toISOString(),
            }))}
            collections={dashboardCollections}
            isPremium={isPremium}
            accessibleCategories={sectionAccessCategories}
            canDownloadPdf={canDownloadPdf}
          />

          {/* Right Sidebar: Recent Activity */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Recent Activity
            </h2>
            
            <div className="space-y-4">
              {recentResults.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
                  <p className="text-slate-400 text-sm font-medium">No tests completed yet. Start your first practice!</p>
                </div>
              ) : (
                recentResults.map((res) => (
                  <Link 
                    key={res.id} 
                    href={`/dashboard/results/${res.id}`}
                    className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(res.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-lg font-black text-blue-600 group-hover:scale-110 transition-transform">
                        {res.score}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {res.test.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full" 
                          style={{ width: `${(res.score / 800) * 100}%` }}
                        ></div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="mt-8 p-6 bg-slate-900 rounded-2xl text-white overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="font-black text-lg mb-2">Target Score: 800</h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-4">
                  Keep working through timed practice sets and review your latest attempts to reach your goal.
                </p>
                <Link
                  href="/dashboard/profile"
                  className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest"
                >
                  View Progress →
                </Link>
              </div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-600/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
    </div>
  );
}
