import SectionAccessManager from '@/components/admin/SectionAccessManager';
import SectionVisibilityForm from '@/components/admin/SectionVisibilityForm';
import AppShell from '@/components/layout/AppShell';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getTestCollections } from '@/lib/testCatalog';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminSectionsPage() {
  const session = await requireAdminPage();

  const [collectionRows, sectionAccesses] = await Promise.all([
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
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

          <div className="space-y-8">
            <SectionAccessManager collections={collections} grants={sectionAccesses} />
            <SectionVisibilityForm collections={collections} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
