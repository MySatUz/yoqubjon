'use server';

import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import {
  activateManualSubscription,
  rejectManualPaymentRequestById,
} from '@/lib/manual-payments';

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

    // These run as `<form action={...}>` on `/admin/payments`, a page that
    // `revalidatePath('/admin')` did not cover: the decision buttons stayed on
    // screen until a manual reload. `refresh()` re-renders the page that
    // submitted the form, in the same response.
    refresh();
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

    await rejectManualPaymentRequestById({
      requestId,
      reviewerId: adminUserId,
      adminNote,
    });

    refresh();
  } catch (error) {
    console.error('Reject manual payment failed:', error);
  }
}
