import SectionAccessManager from '@/components/admin/SectionAccessManager';
import SectionVisibilityForm from '@/components/admin/SectionVisibilityForm';
import AppShell from '@/components/layout/AppShell';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getTestCollections } from '@/lib/testCatalog';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminSectionsPage() {
  const session = await requireAdminPage();

  const [collectionRows, sectionAccesses, users] = await Promise.all([
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
        maxAttempts: true,
      },
    }),
    prisma.sectionAccess.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { email: 'asc' },
      take: 1000,
      select: {
        id: true,
        email: true,
        name: true,
      },
    }),
  ]);

  const collections = getTestCollections(collectionRows);

  return (
    <AppShell session={session} canManageTests>
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <a
              href="/api/admin/results/sections/export"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-600"
            >
              <Download className="h-4 w-4" />
              Download results CSV
            </a>
          </div>

          <div className="space-y-8">
            <SectionAccessManager collections={collections} grants={sectionAccesses} users={users} />
            <SectionVisibilityForm collections={collections} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
