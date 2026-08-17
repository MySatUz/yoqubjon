import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getTestCollections } from '@/lib/testCatalog';

/**
 * Server-side reader for the `TestCollectionVisibility` table.
 *
 * It deliberately does NOT live in `@/lib/testCatalog`: that module is imported
 * by client components, so it must stay free of any Prisma import.
 *
 * The table holds a handful of rows that change a few times a month but is read
 * on almost every page render, so the read is cached in the Next data cache and
 * invalidated by tag. Every action that writes `TestCollectionVisibility` must
 * call `revalidateTag(TEST_COLLECTIONS_CACHE_TAG, { expire: 0 })` so section
 * visibility changes are visible on the very next request.
 */
export const TEST_COLLECTIONS_CACHE_TAG = 'test-collections';

export type CollectionVisibilityRow = {
  category: string;
  label: string | null;
  description: string | null;
  position: number;
  visible: boolean;
  maxAttempts: number;
};

const readCollectionVisibilityRows = unstable_cache(
  async (): Promise<CollectionVisibilityRow[]> =>
    prisma.testCollectionVisibility.findMany({
      orderBy: [{ position: 'asc' }, { category: 'asc' }],
      select: {
        category: true,
        label: true,
        description: true,
        position: true,
        visible: true,
        maxAttempts: true,
      },
    }),
  ['test-collection-visibility'],
  { tags: [TEST_COLLECTIONS_CACHE_TAG], revalidate: 300 }
);

// `cache()` collapses repeats inside one request, `unstable_cache` across requests.
export const getCollectionVisibilityRows = cache(
  async (): Promise<CollectionVisibilityRow[]> => readCollectionVisibilityRows()
);

/** Same shape `getTestCollections(rows)` returns for the direct Prisma callers. */
export const getCachedTestCollections = cache(async () =>
  getTestCollections(await getCollectionVisibilityRows())
);
