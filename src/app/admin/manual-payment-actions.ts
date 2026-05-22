'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { activateManualSubscription } from '@/lib/manual-payments';

function getRequestId(formData: FormData) {
  const requestId = formData.get('requestId');
  if (typeof requestId !== 'string' || !requestId.trim()) {
    throw new Error('Payment request id is required');
  }
  return requestId.trim();
}

function getAdminNote(formData: FormData) {
  const note = formData.get('adminNote');
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export async function approveManualPaymentRequest(formData: FormData) {
  try {
    const session = await requireAdmin();
    const adminUserId = session?.user?.id;
    if (!adminUserId) throw new Error('Admin session is missing');

    const requestId = getRequestId(formData);
    const adminNote = getAdminNote(formData);

    await activateManualSubscription({
      requestId,
      adminUserId,
      adminNote,
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/subscription');
  } catch (error) {
    console.error('Approve manual payment failed:', error);
  }
}

export async function rejectManualPaymentRequest(formData: FormData) {
  try {
    const session = await requireAdmin();
    const adminUserId = session?.user?.id;
    if (!adminUserId) throw new Error('Admin session is missing');

    const requestId = getRequestId(formData);
    const adminNote = getAdminNote(formData);

    const result = await prisma.manualPaymentRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        adminNote,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new Error('Payment request has already been reviewed');
    }

    revalidatePath('/admin');
    revalidatePath('/dashboard/subscription');
  } catch (error) {
    console.error('Reject manual payment failed:', error);
  }
}
