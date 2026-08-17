import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import UserDirectoryPanel from '@/components/admin/UserDirectoryPanel';
import { isOwnerSessionUser, OWNER_ADMIN_EMAIL, requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Turns a `groupBy(['userId'])` result into an id -> count lookup.
 *
 * The counts used to be four relation `_count`s on the user query, which Prisma
 * compiles into one correlated aggregate per relation — 4 index scans for every
 * one of the 1000 rows. One grouped scan per relation replaces all of that, and
 * the four scans run in parallel with the user query itself.
 */
function toCountMap(rows: Array<{ userId: string; _count: { _all: number } }>) {
  return new Map(rows.map((row) => [row.userId, row._count._all]));
}

export default async function AdminUsersPage() {
  // Kept here on purpose: access must not depend on the segment layout.
  const session = await requireAdminPage();
  const canManageAdmins = isOwnerSessionUser(session?.user);
  const now = new Date();

  const [
    userRows,
    userCount,
    resultRows,
    activeSubscriptionRows,
    paymentRows,
    manualPaymentRows,
  ] = await Promise.all([
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
      },
    }),
    prisma.user.count(),
    prisma.result.groupBy({
      by: ['userId'],
      _count: { _all: true },
    }),
    prisma.subscription.groupBy({
      by: ['userId'],
      where: {
        isActive: true,
        expiresAt: { gt: now },
      },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['userId'],
      _count: { _all: true },
    }),
    prisma.manualPaymentRequest.groupBy({
      by: ['userId'],
      _count: { _all: true },
    }),
  ]);

  const resultsByUser = toCountMap(resultRows);
  const subscriptionsByUser = toCountMap(activeSubscriptionRows);
  const paymentsByUser = toCountMap(paymentRows);
  const manualPaymentsByUser = toCountMap(manualPaymentRows);

  // Same shape the relation `_count` produced, so the client panels are untouched.
  const users = userRows.map((user) => ({
    ...user,
    _count: {
      results: resultsByUser.get(user.id) ?? 0,
      subscriptions: subscriptionsByUser.get(user.id) ?? 0,
      payments: paymentsByUser.get(user.id) ?? 0,
      manualPaymentRequests: manualPaymentsByUser.get(user.id) ?? 0,
    },
  }));

  const userDirectory = <UserDirectoryPanel users={users} totalCount={userCount} />;
  // AdminUsersPanel only reads id/email/name/role — sending the full rows would
  // serialize the whole directory into the RSC payload a second time.
  const adminCandidates = canManageAdmins
    ? users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }))
    : [];

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

        {canManageAdmins ? (
          <AdminUsersPanel
            users={adminCandidates}
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
  );
}
