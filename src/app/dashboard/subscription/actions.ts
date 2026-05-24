'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

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

  revalidatePath('/dashboard/subscription');
  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard');

  return { success: true, canceled: result.count };
}
