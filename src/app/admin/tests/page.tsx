import AdminForm from '@/components/admin/AdminForm';
import TestList from '@/components/admin/TestList';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getTestCollections, sortCatalogTests } from '@/lib/testCatalog';
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

export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
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

  const testCount = orderingRows.length;
  const pageIds = sortCatalogTests(orderingRows)
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

  const collections = getTestCollections(collectionRows);
  const totalPages = Math.max(1, Math.ceil(testCount / TESTS_PAGE_SIZE));

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>

        <div className="space-y-10">
          <AdminForm collections={collections} />
          <div className="space-y-4">
            {testCount > 0 && (
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Showing {tests.length ? skip + 1 : 0}&ndash;{skip + tests.length} of {testCount} tests
              </p>
            )}
            {/* TestList still receives one sorted array, so its props are unchanged. */}
            <TestList tests={tests} collections={collections} />

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {currentPage > 1 ? (
                  <Link
                    href={currentPage - 1 === 1 ? '/admin/tests' : `/admin/tests?page=${currentPage - 1}`}
                    prefetch={false}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <Link
                    href={`/admin/tests?page=${currentPage + 1}`}
                    prefetch={false}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
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
