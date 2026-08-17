import TestList from '@/components/admin/TestList';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getTestCollections } from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminTestEditorPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [test, collectionRows] = await Promise.all([
    prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            content: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            imageUrl: true,
            videoUrl: true,
            order: true,
          },
        },
        _count: {
          select: { questions: true },
        },
      },
    }),
    getCollectionVisibilityRows(),
  ]);

  if (!test) {
    notFound();
  }

  const collections = getTestCollections(collectionRows);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin/tests"
          className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tests
        </Link>

        <TestList tests={[test]} collections={collections} initialOpenTestId={test.id} />
      </div>
    </div>
  );
}
