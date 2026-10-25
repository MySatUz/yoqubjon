import { cache } from 'react';
import { auth } from '@/auth';
import { isAdminUser } from '@/lib/admin';
import { getStudentView } from '@/lib/studentView';
import { prisma } from '@/lib/prisma';

/**
 * Request-scoped memoization for the shell islands. The shell renders the user
 * block twice (mobile header + desktop sidebar) and the admin nav item twice
 * (mobile bar + desktop sidebar), each inside its own <Suspense> boundary, so
 * without `cache()` a single dashboard render would decode the JWT and hit the
 * database several times.
 */
export const getShellSession = cache(async () => auth());

/**
 * The name and email on the user row and in the account menu, read from the
 * database rather than the session. The JWT keeps the name the student signed
 * in with, so a name changed in Profile would reach the sidebar only after the
 * next sign-in; this read follows Profile's revalidatePath at once. One
 * primary-key read per request, shared by both rows. A row that is gone (the
 * cookie outlived the account) falls back to what the session says.
 */
export const getShellUser = cache(async () => {
  const session = await getShellSession();
  const userId = session?.user?.id;
  const fromSession = { name: session?.user?.name ?? null, email: session?.user?.email ?? null };
  if (!userId) return fromSession;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return user ?? fromSession;
});

export const getShellCanManageTests = cache(async () => {
  const session = await getShellSession();
  return isAdminUser(session?.user?.id);
});

export const getShellStudentView = cache(async () => {
  const session = await getShellSession();
  return getStudentView(session?.user?.id);
});

/** Manual payment requests waiting for a decision: the count beside the sidebar's Subscription row, where admins review them. */
export const getShellPendingPayments = cache(async () =>
  prisma.manualPaymentRequest.count({ where: { status: 'PENDING' } })
);
