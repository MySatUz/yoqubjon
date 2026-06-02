'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, FileDown, Layers3, LayoutDashboard, Lock, Sparkles } from 'lucide-react';
import {
  getCategoryLabel,
  getTestDescription,
  type TestCategory,
} from '@/lib/testCatalog';
import { useEffect, useMemo, useState, useTransition } from 'react';

type CatalogTest = {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  createdAt: string;
};

type PracticeCatalogProps = {
  initialCategory: TestCategory | null;
  standardTests: CatalogTest[];
  advancedTests: CatalogTest[];
  isPremium: boolean;
  canDownloadPdf: boolean;
};

function readCategoryFromUrl() {
  if (typeof window === 'undefined') return null;

  const set = new URLSearchParams(window.location.search).get('set');
  if (set === 'advanced') return 'ADVANCED';
  if (set === 'standard') return 'STANDARD';
  return null;
}

function categoryToQuery(category: TestCategory | null) {
  if (category === 'ADVANCED') return '?set=advanced';
  if (category === 'STANDARD') return '?set=standard';
  return '';
}

export default function PracticeCatalog({
  initialCategory,
  standardTests,
  advancedTests,
  isPremium,
  canDownloadPdf,
}: PracticeCatalogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeCategory, setActiveCategory] = useState<TestCategory | null>(initialCategory);

  useEffect(() => {
    const handlePopState = () => setActiveCategory(readCategoryFromUrl());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const visibleTests = activeCategory === 'ADVANCED'
    ? advancedTests
    : activeCategory === 'STANDARD'
      ? standardTests
      : [];

  const collections = useMemo(() => [
    {
      category: 'STANDARD' as const,
      title: 'Standard tests',
      count: standardTests.length,
      description: 'Core Digital SAT Math modules for steady practice and baseline review.',
      icon: Layers3,
      theme: 'bg-blue-600 text-white shadow-blue-200',
    },
    {
      category: 'ADVANCED' as const,
      title: 'Advanced set',
      count: advancedTests.length,
      description: 'Harder sets for students targeting top scores and deeper problem solving.',
      icon: Sparkles,
      theme: 'bg-slate-900 text-white shadow-slate-200',
    },
  ], [advancedTests.length, standardTests.length]);

  const switchCategory = (category: TestCategory | null) => {
    startTransition(() => {
      setActiveCategory(category);
      window.history.pushState(null, '', `/dashboard${categoryToQuery(category)}`);
    });
  };

  const prefetchTestLinks = (testId: string) => {
    router.prefetch(`/exam/${testId}`);
    if (canDownloadPdf) router.prefetch(`/exam/${testId}/pdf`);
  };

  return (
    <div className="lg:col-span-3">
      <header className="mb-10">
        {activeCategory ? (
          <button
            type="button"
            onClick={() => switchCategory(null)}
            className="mb-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to collections
          </button>
        ) : null}
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          {activeCategory ? getCategoryLabel(activeCategory) : 'Practice Center'}
        </h1>
        <p className="text-slate-500 mt-2 text-lg font-medium">
          {activeCategory === 'ADVANCED'
            ? 'Work through the advanced sets in order, from Advanced set 1 upward.'
            : activeCategory === 'STANDARD'
              ? 'Start with the standard SAT Math practice modules.'
              : 'Choose a collection, then select the module you want to practice.'}
        </p>
      </header>

      {!activeCategory ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {collections.map((collection) => {
            const Icon = collection.icon;

            return (
              <button
                key={collection.category}
                type="button"
                onClick={() => switchCategory(collection.category)}
                disabled={isPending}
                className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-900/10 disabled:cursor-wait disabled:opacity-80"
              >
                <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-slate-50 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div className={`rounded-3xl p-5 shadow-xl ${collection.theme}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
                      {collection.count} {collection.count === 1 ? 'test' : 'tests'}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">{collection.title}</h2>
                  <p className="mt-3 min-h-14 text-base font-bold leading-relaxed text-slate-500">
                    {collection.description}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-black text-blue-600">
                    Open collection
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {visibleTests.map((test) => {
            const canAccess = test.isFree || isPremium;
            const description = getTestDescription(test);

            return (
              <div
                key={test.id}
                onMouseEnter={() => prefetchTestLinks(test.id)}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${canAccess ? 'bg-blue-600' : 'bg-slate-100'} text-white shadow-lg ${canAccess ? 'shadow-blue-200' : ''}`}>
                      {canAccess ? <LayoutDashboard className="w-6 h-6" /> : <Lock className="w-6 h-6 text-slate-400" />}
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                      test.isFree
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {test.isFree ? 'Free Access' : 'Premium'}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 mb-3">{test.title}</h3>
                  <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">
                    {description}
                  </p>

                  {canAccess ? (
                    <div className="space-y-3">
                      <Link
                        href={`/exam/${test.id}`}
                        prefetch
                        onFocus={() => prefetchTestLinks(test.id)}
                        className="inline-flex items-center justify-center w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-slate-900 hover:bg-blue-600 transition-all transform active:scale-95 shadow-xl shadow-slate-200"
                      >
                        Start Practice Module
                      </Link>
                      {canDownloadPdf && (
                        <Link
                          href={`/exam/${test.id}/pdf`}
                          prefetch
                          onFocus={() => router.prefetch(`/exam/${test.id}/pdf`)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
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
                        prefetch
                        className="inline-flex items-center justify-center w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 transition-all transform active:scale-95 shadow-xl shadow-blue-100"
                      >
                        Unlock with Premium
                      </Link>
                      <button disabled className="w-full py-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Module Locked
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {visibleTests.length === 0 && (
            <div className="col-span-full py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <p className="text-slate-400 font-bold">No tests available yet. Check back later!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
