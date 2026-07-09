import AdminSectionHub from '@/components/admin/AdminSectionHub';
import AppShell from '@/components/layout/AppShell';
import { isOwnerSessionUser, OWNER_ADMIN_EMAIL, requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getTestCollections } from '@/lib/testCatalog';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export default async function AdminPage() {
  const session = await requireAdminPage();
  const canManageAdmins = isOwnerSessionUser(session?.user);

  const [
    userCount,
    adminCount,
    paymentCount,
    pendingPaymentCount,
    visibleTestCount,
    testCount,
    collectionRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        OR: [
          { role: 'ADMIN' },
          { email: OWNER_ADMIN_EMAIL },
        ],
      },
    }),
    prisma.manualPaymentRequest.count(),
    prisma.manualPaymentRequest.count({ where: { status: 'PENDING' } }),
    prisma.test.count({ where: { visible: true } }),
    prisma.test.count(),
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
  const visibleSectionCount = collections.filter((collection) => collection.visible).length;

  return (
    <AppShell session={session} canManageTests>
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h1 className="mb-2 text-4xl font-black tracking-tight text-slate-900">Admin Test Manager</h1>
            <p className="font-medium text-slate-500">
              Choose a section. Heavy lists load only after you open the section.
            </p>
          </div>

          <AdminSectionHub
            canManageAdmins={canManageAdmins}
            adminCount={adminCount}
            userCount={userCount}
            paymentCount={paymentCount}
            pendingPaymentCount={pendingPaymentCount}
            visibleSectionCount={visibleSectionCount}
            visibleTestCount={visibleTestCount}
            testCount={testCount}
          />
        </div>
      </div>
    </AppShell>
  );
}
