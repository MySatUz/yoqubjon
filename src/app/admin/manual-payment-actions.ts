'use server';

import { revalidatePath } from 'next/cache';
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

/**
 * Said back to the admin: a decision that failed (a request another admin, or
 * the Telegram bot, reviewed a moment earlier) used to leave the buttons on
 * screen with no word of what happened.
 */
type PaymentDecisionResult = { success: true } | { success: false; error: string };

/**
 * The queue is on the Subscription page, under #payments (the admin Payments
 * page is gone). In a server action this re-renders that page in the same
 * response, so the decision buttons leave the screen without a reload; the
 * student's own copy of the page is fresh on their next visit.
 */
function revalidatePaymentQueue() {
  revalidatePath('/dashboard/subscription');
}

function getAdminNote(formData: FormData) {
  const note = formData.get('adminNote');
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export async function approveManualPaymentRequest(formData: FormData): Promise<PaymentDecisionResult> {
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

    revalidatePaymentQueue();
    return { success: true };
  } catch (error) {
    console.error('Approve manual payment failed:', error);
    // The usual failure is a request another admin or the Telegram bot has
    // just reviewed: the refreshed page shows it as it now stands, instead of
    // leaving it marked pending beside the error.
    revalidatePaymentQueue();
    return { success: false, error: error instanceof Error ? error.message : 'Could not approve the payment' };
  }
}

export async function rejectManualPaymentRequest(formData: FormData): Promise<PaymentDecisionResult> {
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

    revalidatePaymentQueue();
    return { success: true };
  } catch (error) {
    console.error('Reject manual payment failed:', error);
    revalidatePaymentQueue();
    return { success: false, error: error instanceof Error ? error.message : 'Could not reject the payment' };
  }
}
