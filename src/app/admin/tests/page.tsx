import AdminForm from '@/components/admin/AdminForm';
import SectionPicker from '@/components/admin/SectionPicker';
import TestList from '@/components/admin/TestList';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getTestCategory, getTestCollections, sortCatalogTests } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TESTS_PAGE_SIZE = 50;

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 1 ? Math.floor(parsed) : 1;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Keeps the section across pagination links. */
function buildTestsHref(category: string, page: number) {
  const params = new URLSearchParams({ category });
  if (page > 1) params.set('page', String(page));

  return `/admin/tests?${params}`;
}

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; category?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const currentPage = parsePage(resolvedSearchParams?.page);
  const skip = (currentPage - 1) * TESTS_PAGE_SIZE;

  // Catalog order cannot be expressed in SQL: `getTestCategory` reads several
  // sources and `getSetNumber` pulls the set number out of the title with a
  // regex. So the ordering key is built over every test first, using only the
  // four columns the comparator touches, and the page is sliced out of the
  // fully sorted list. Paging on a raw `createdAt` slice instead would give
  // page 2 an order that does not exist in the global catalog.
  const [orderingRows, collectionRows] = await Promise.all([
    prisma.test.findMany({
      // Feeds the sort in the same order the unpaginated query used; the sort is
      // stable, so exact ties keep the order they had before pagination.
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        collectionCategory: true,
        createdAt: true,
      },
    }),
    getCollectionVisibilityRows(),
  ]);

  const collections = getTestCollections(collectionRows);

  // Every test belongs to a section, so the admin always works inside one rather
  // than in a single mixed list. An unknown or missing `?category=` falls back to
  // the first section by position, which is what the page shows on a plain visit.
  const requestedCategory = readParam(resolvedSearchParams?.category);
  const selectedCategory =
    collections.find((option) => option.value === requestedCategory)?.value ??
    collections[0]?.value;

  const countsByCategory = new Map<string, number>();
  for (const test of orderingRows) {
    const category = getTestCategory(test);
    if (category) countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
  }

  const sectionRows = orderingRows.filter((test) => getTestCategory(test) === selectedCategory);

  const testCount = sectionRows.length;
  const pageIds = sortCatalogTests(sectionRows)
    .slice(skip, skip + TESTS_PAGE_SIZE)
    .map((test) => test.id);

  // Only the visible page pays for the wide columns and the question count.
  const pageRows = pageIds.length > 0
    ? await prisma.test.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true,
          title: true,
          description: true,
          collectionCategory: true,
          durationSeconds: true,
          moduleDurations: true,
          maxAttempts: true,
        olympiadStartsAt: true,
        olympiadEndsAt: true,
          accessCode: true,
          isFree: true,
          visible: true,
          createdAt: true,
          _count: {
            select: { questions: true },
          },
        },
      })
    : [];

  // `WHERE id IN (...)` does not preserve the order of the list, so the sorted
  // order is reapplied here.
  const rowsById = new Map(pageRows.map((test) => [test.id, test]));
  const tests = pageIds
    .map((id) => rowsById.get(id))
    .filter((test): test is (typeof pageRows)[number] => test !== undefined);

  const totalPages = Math.max(1, Math.ceil(testCount / TESTS_PAGE_SIZE));

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>

        <SectionPicker
          collections={collections}
          selected={selectedCategory}
          counts={Object.fromEntries(countsByCategory)}
        />

        <div className="space-y-10">
          {/* Remounted per section: the form keeps the chosen section and its
              attempt limit in state, which would otherwise survive the switch. */}
          <AdminForm
            key={selectedCategory}
            collections={collections}
            defaultCategory={selectedCategory}
          />
          <div className="space-y-4">
            {testCount > 0 && (
              <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
                Showing {tests.length ? skip + 1 : 0}&ndash;{skip + tests.length} of {testCount} tests in this section
              </p>
            )}
            {/* TestList still receives one sorted array, so its props are unchanged. */}
            <TestList tests={tests} collections={collections} />

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {currentPage > 1 ? (
                  <Link
                    href={buildTestsHref(selectedCategory, currentPage - 1)}
                    prefetch={false}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <Link
                    href={buildTestsHref(selectedCategory, currentPage + 1)}
                    prefetch={false}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
