'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Atom, FileDown, FolderKanban, Layers3, LayoutDashboard, Lock, Repeat2, Sparkles } from 'lucide-react';
import {
  findCategoryByQuery,
  getCategoryQueryValue,
  getTestCategory,
  getTestDescription,
  type TestCategory,
  type TestCollectionOption,
} from '@/lib/testCatalog';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { formatModuleBadge } from '@/lib/examModules';

type CatalogTest = {
  id: string;
  title: string;
  description: string | null;
  collectionCategory: string | null;
  durationSeconds: number;
  moduleDurations: number[];
  maxAttempts: number;
  attemptsUsed: number;
  isFree: boolean;
  visible: boolean;
  createdAt: string;
};

type PracticeCatalogProps = {
  initialCategory: TestCategory | null;
  tests: CatalogTest[];
  collections: TestCollectionOption[];
  isPremium: boolean;
  isAdmin: boolean;
  accessibleCategories: string[];
  canDownloadPdf: boolean;
};

function readCategoryFromUrl(collections: TestCollectionOption[]) {
  if (typeof window === 'undefined') return null;

  const set = new URLSearchParams(window.location.search).get('set') ?? undefined;
  return findCategoryByQuery(collections, set);
}

function categoryToQuery(category: TestCategory | null) {
  return category ? `?set=${encodeURIComponent(getCategoryQueryValue(category))}` : '';
}

function getCollectionIcon(category: string) {
  if (category === 'PLANCK') return Atom;
  if (category === 'ADVANCED') return Sparkles;
  if (category === 'STANDARD') return Layers3;
  return FolderKanban;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  return `${minutes} min`;
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
      className="inline-flex items-center justify-center w-full py-4 px-6 rounded-2xl text-sm font-semibold text-white bg-slate-900 hover:bg-blue-600 transition-[background-color,transform] duration-200 active:scale-95 shadow-lg"
    >
      Start Practice Module
    </Link>
  );
}

export default function PracticeCatalog({
  initialCategory,
  tests,
  collections,
  isPremium,
  isAdmin,
  accessibleCategories,
  canDownloadPdf,
}: PracticeCatalogProps) {
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState<TestCategory | null>(initialCategory);
  const visibleCollections = useMemo(
    () => collections.filter((collection) => collection.visible),
    [collections]
  );
  const accessibleCategorySet = useMemo(
    () => new Set(accessibleCategories),
    [accessibleCategories]
  );

  useEffect(() => {
    const handlePopState = () => setActiveCategory(readCategoryFromUrl(visibleCollections));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [visibleCollections]);

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

  const switchCategory = (category: TestCategory | null) => {
    startTransition(() => {
      setActiveCategory(category);
      window.history.pushState(null, '', `/dashboard${categoryToQuery(category)}`);
    });
  };

  return (
    <div className="lg:col-span-3">
      <header className="mb-10">
        {effectiveActiveCategory ? (
          <button
            type="button"
            onClick={() => switchCategory(null)}
            className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to collections
          </button>
        ) : null}
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          {activeCollection ? activeCollection.label : 'Practice Center'}
        </h1>
        <p className="text-slate-500 mt-2 text-lg font-medium">
          {activeCollection?.description || 'Choose a collection, then select the module you want to practice.'}
        </p>
      </header>

      {!effectiveActiveCategory ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {visibleCollections.map((collection) => {
            const Icon = getCollectionIcon(collection.value);
            const count = testsByCategory.get(collection.value)?.length ?? 0;

            return (
              <button
                key={collection.value}
                type="button"
                onClick={() => switchCategory(collection.value)}
                disabled={isPending}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-2xl hover: disabled:cursor-wait disabled:opacity-80"
              >
                <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-slate-50 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="mb-8 flex items-start justify-between gap-4">
                    {/* One treatment for every collection: the icon and the
                        label carry the difference, not a rotating hue. */}
                    <div className="rounded-2xl bg-blue-600 p-5 text-white">
                      <Icon className="h-8 w-8" />
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                      {count} {count === 1 ? 'test' : 'tests'}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">{collection.label}</h2>
                  <p className="mt-3 min-h-14 text-base font-semibold leading-relaxed text-slate-500">
                    {collection.description}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                    Open collection
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}

          {visibleCollections.length === 0 && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-20 text-center">
              <p className="font-semibold text-slate-400">No practice collections are available right now.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {visibleTests.map((test) => {
            const category = getTestCategory(test);
            const hasSectionAccess = Boolean(category && accessibleCategorySet.has(category));
            const canAccess = isAdmin || test.isFree || isPremium || hasSectionAccess;
            const attemptLimitReached = !isAdmin && test.attemptsUsed >= test.maxAttempts;
            const canStart = canAccess && !attemptLimitReached;
            const accessLabel = test.isFree
              ? 'Free Access'
              : hasSectionAccess && !isPremium
                ? 'Course Access'
                : 'Premium';
            const description = getTestDescription(test);

            return (
              <div
                key={test.id}
                className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 hover:shadow-lg hover: transition-[transform,border-color] duration-300 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${canStart ? 'bg-blue-600' : 'bg-slate-100'} text-white shadow-lg ${canStart ? '' : ''}`}>
                      {canStart ? <LayoutDashboard className="w-6 h-6" /> : <Lock className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-widest border ${
                        test.isFree
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {accessLabel}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-slate-500">
                        {formatDuration(test.durationSeconds)}
                      </span>
                      {formatModuleBadge(test) && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-blue-700">
                          {formatModuleBadge(test)}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-widest ${
                        attemptLimitReached
                          ? 'border-amber-200 bg-amber-100 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}>
                        <Repeat2 className="h-3 w-3" />
                        {isAdmin ? 'Unlimited attempts' : `${test.attemptsUsed}/${test.maxAttempts} attempts`}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-2xl font-semibold text-slate-900 mb-3">{test.title}</h3>
                  <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">
                    {description}
                  </p>

                  {canAccess ? (
                    <div className="space-y-3">
                      {attemptLimitReached ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-2xl bg-slate-200 px-6 py-4 text-sm font-semibold text-slate-500"
                        >
                          Attempt limit reached
                        </button>
                      ) : (
                        <StartPracticeLink testId={test.id} />
                      )}
                      {canDownloadPdf && (
                        <Link
                          href={`/exam/${test.id}/pdf`}
                          prefetch={false}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition-[color,border-color] duration-200 hover:border-blue-200 hover:text-blue-600"
                        >
                          <FileDown className="h-4 w-4" />
                          Download questions PDF
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Link
                        href="/dashboard/subscription"
                        className="inline-flex items-center justify-center w-full py-4 px-6 rounded-2xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-[background-color,transform] duration-200 active:scale-95 shadow-lg"
                      >
                        Unlock with Premium
                      </Link>
                      <button disabled className="w-full py-3 text-xs font-medium text-slate-400 uppercase tracking-widest">
                        Module Locked
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {visibleTests.length === 0 && (
            <div className="col-span-full py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-semibold">No tests available yet. Check back later!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
