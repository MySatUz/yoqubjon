import type { Metadata } from 'next';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import UserDirectoryPanel from '@/components/admin/UserDirectoryPanel';
import { isOwnerSessionUser, OWNER_ADMIN_EMAIL, requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { normalizeAccessEmail } from '@/lib/sectionAccess';
import { Page, PageHeader } from '@/components/ui/Page';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata: Metadata = { title: 'Users' };

/**
 * Turns a `groupBy(['userId'])` result into an id -> count lookup.
 *
 * The counts used to be relation `_count`s on the user query, which Prisma
 * compiles into one correlated aggregate per relation — an index scan for every
 * one of the 1000 rows. One grouped scan per relation replaces all of that, and
 * the scans run in parallel with the user query itself.
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
    sectionAccessRows,
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
    // The latest attempt doubles as "last active": a sign-in leaves no trace in
    // the database, but practice does, and practice is what an admin asks about.
    prisma.result.groupBy({
      by: ['userId'],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.subscription.groupBy({
      by: ['userId'],
      where: {
        isActive: true,
        expiresAt: { gt: now },
      },
      _count: { _all: true },
    }),
    // Course access is given by email, often before the student signs up,
    // so it is matched on the email rather than on a user id.
    prisma.sectionAccess.groupBy({
      by: ['email'],
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      _count: { _all: true },
    }),
  ]);

  const resultsByUser = toCountMap(resultRows);
  const lastActiveByUser = new Map(resultRows.map((row) => [row.userId, row._max.createdAt]));
  const subscriptionsByUser = toCountMap(activeSubscriptionRows);
  const sectionsByEmail = new Map(sectionAccessRows.map((row) => [row.email, row._count._all]));

  const users = userRows.map((user) => ({
    ...user,
    attempts: resultsByUser.get(user.id) ?? 0,
    lastActiveAt: lastActiveByUser.get(user.id) ?? null,
    hasSubscription: (subscriptionsByUser.get(user.id) ?? 0) > 0,
    sectionAccessCount: sectionsByEmail.get(normalizeAccessEmail(user.email)) ?? 0,
  }));

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

  // The directory comes first: it is what the page is named after. Giving
  // admin access is the owner's rare errand, so its card sits below.
  return (
    <Page>
      {/* No "Back to admin" on phones: there is no admin hub, and the row of
          admin places above the page (AdminMobileNav) is the way around. */}
      <PageHeader
        title="Users"
        description={
          canManageAdmins
            ? 'Everyone signed up. Open a user to see their courses and results, or give admin access below.'
            : 'Everyone signed up. Open a user to see their courses and results.'
        }
      />

      <UserDirectoryPanel users={users} totalCount={userCount} />

      {canManageAdmins && <AdminUsersPanel users={adminCandidates} ownerEmail={OWNER_ADMIN_EMAIL} />}
    </Page>
  );
}
