import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import UserDirectoryPanel from '@/components/admin/UserDirectoryPanel';
import AppShell from '@/components/layout/AppShell';
import { isOwnerSessionUser, OWNER_ADMIN_EMAIL, requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminUsersPage() {
  const session = await requireAdminPage();
  const canManageAdmins = isOwnerSessionUser(session?.user);
  const now = new Date();

  const [users, userCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: [
        { role: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 1000,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            results: true,
            subscriptions: {
              where: {
                isActive: true,
                expiresAt: { gt: now },
              },
            },
            payments: true,
            manualPaymentRequests: true,
          },
        },
      },
    }),
    prisma.user.count(),
  ]);

  const userDirectory = <UserDirectoryPanel users={users} totalCount={userCount} />;

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

          {canManageAdmins ? (
            <AdminUsersPanel
              users={users}
              ownerEmail={OWNER_ADMIN_EMAIL}
              userCount={userCount}
              userDirectory={userDirectory}
              initialShowUsers
            />
          ) : (
            userDirectory
          )}
        </div>
      </div>
    </AppShell>
  );
}
