'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { refresh } from 'next/cache';

export async function cancelActiveSubscription() {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  const result = await prisma.subscription.updateMany({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    data: {
      isActive: false,
      providerStatus: 'CANCELED',
    },
  });

  // Every dashboard page reads the session, so all three were dynamic and had
  // no cache entry to invalidate; the fresh payload now comes back with this
  // action's response.
  refresh();

  return { success: true, canceled: result.count };
}
