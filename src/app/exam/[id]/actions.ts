'use server';

import { auth } from '@/auth';
import { submitTestAccessCode, type CodeAttemptResult } from '@/lib/testAccessCode';

/**
 * Only decides whether the code is right. Every other gate - visibility, the
 * olympiad window, the attempt limit, the subscription - is still enforced by
 * the exam page itself, which `AccessCodeGate` fetches again on success.
 *
 * No `refresh()` here: it only refreshes the dynamic data, and the router
 * keeps a page prefetched in full as it was, so the code screen came back.
 */
export async function unlockTestWithCode(testId: string, code: string): Promise<CodeAttemptResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: 'Please sign in again.' };
  }

  if (typeof testId !== 'string' || !testId || testId.length > 160) {
    return { success: false, error: 'Test not found.' };
  }

  try {
    return await submitTestAccessCode(session.user.id, testId, code);
  } catch (error: unknown) {
    console.error('Unlock Test Error:', error);
    return { success: false, error: 'Could not check the code. Please try again.' };
  }
}
