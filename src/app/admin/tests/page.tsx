import AdminForm from '@/components/admin/AdminForm';
import TestList from '@/components/admin/TestList';
import AppShell from '@/components/layout/AppShell';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { compareCatalogTests, getTestCollections } from '@/lib/testCatalog';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminTestsPage() {
  const session = await requireAdminPage();

  const [tests, collectionRows] = await Promise.all([
    prisma.test.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        collectionCategory: true,
        durationSeconds: true,
        isFree: true,
        visible: true,
        createdAt: true,
        _count: {
          select: { questions: true },
        },
      },
    }),
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
      },
    }),
  ]);

  const collections = getTestCollections(collectionRows);

  return (
    <AppShell session={session} canManageTests>
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
            <TestList tests={tests.sort(compareCatalogTests)} collections={collections} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
