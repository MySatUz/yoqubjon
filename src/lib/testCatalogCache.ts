import { cache } from 'react';
import { revalidateTag, unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

/**
 * Every test with the fields the Practice catalog shows, and how many
 * questions each holds - the same for every student, and read on every visit
 * to Practice, so it is kept in the Next data cache. Prisma Postgres bills
 * every read; tests change only when an admin changes them.
 *
 * Every action that creates, edits, hides, copies or deletes a test, or adds
 * or moves its questions, must call `expireTestCatalog()`. The 10-minute
 * revalidation is only a net under a writer that forgets.
 *
 * What is here reaches the browser (the catalog spreads each test into its
 * props), so nothing secret belongs in the select: no access code, no key.
 */
export const TEST_CATALOG_CACHE_TAG = 'test-catalog';

export function expireTestCatalog() {
  revalidateTag(TEST_CATALOG_CACHE_TAG, { expire: 0 });
}

const CATALOG_TEST_SELECT = {
  id: true,
  title: true,
  description: true,
  collectionCategory: true,
  durationSeconds: true,
  moduleDurations: true,
  // "No time limit" instead of the placeholder minutes stored under it.
  untimed: true,
  homework: true,
  maxAttempts: true,
  isFree: true,
  visible: true,
  createdAt: true,
  olympiadStartsAt: true,
  olympiadEndsAt: true,
  questionSourceId: true,
} as const;

/**
 * The data cache keeps JSON, so a `Date` would come back from a hit as a
 * string but from a miss as a `Date`. The cached shape holds strings either
 * way, and `getTestCatalog` turns them back into dates.
 */
async function readStoredCatalog() {
  const [tests, questionCounts] = await Promise.all([
    prisma.test.findMany({ orderBy: { createdAt: 'asc' }, select: CATALOG_TEST_SELECT }),
    prisma.question.groupBy({ by: ['testId'], _count: { _all: true } }),
  ]);

  return {
    tests: tests.map((test) => ({
      ...test,
      createdAt: test.createdAt.toISOString(),
      olympiadStartsAt: test.olympiadStartsAt?.toISOString() ?? null,
      olympiadEndsAt: test.olympiadEndsAt?.toISOString() ?? null,
    })),
    // A copy has no rows of its own; readers count its original's.
    questionCounts: questionCounts.map((row) => [row.testId, row._count._all] as [string, number]),
  };
}

const loadStoredCatalog = unstable_cache(readStoredCatalog, ['test-catalog', 'v1'], {
  tags: [TEST_CATALOG_CACHE_TAG],
  revalidate: 600,
});

export type CatalogTest = Omit<
  Awaited<ReturnType<typeof readStoredCatalog>>['tests'][number],
  'createdAt' | 'olympiadStartsAt' | 'olympiadEndsAt'
> & {
  createdAt: Date;
  olympiadStartsAt: Date | null;
  olympiadEndsAt: Date | null;
};

// `cache()` collapses repeats inside one request, `unstable_cache` across requests.
export const getTestCatalog = cache(async () => {
  const stored = await loadStoredCatalog();
  const tests: CatalogTest[] = stored.tests.map((test) => ({
    ...test,
    createdAt: new Date(test.createdAt),
    olympiadStartsAt: test.olympiadStartsAt ? new Date(test.olympiadStartsAt) : null,
    olympiadEndsAt: test.olympiadEndsAt ? new Date(test.olympiadEndsAt) : null,
  }));
  /** Questions stored under each test id; for a copy, look up its `questionSourceId`. */
  const ownQuestionCount = new Map(stored.questionCounts);
  return { tests, byId: new Map(tests.map((test) => [test.id, test])), ownQuestionCount };
});
