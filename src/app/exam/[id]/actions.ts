'use server';

import { refresh } from 'next/cache';
import { auth } from '@/auth';
import { submitTestAccessCode, type CodeAttemptResult } from '@/lib/testAccessCode';

/**
 * Only decides whether the code is right. Every other gate - visibility, the
 * olympiad window, the attempt limit, the subscription - is still enforced by
 * the exam page itself when it re-renders after `refresh()`.
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
    const result = await submitTestAccessCode(session.user.id, testId, code);

    if (result.success) {
      refresh();
    }

    return result;
  } catch (error: unknown) {
    console.error('Unlock Test Error:', error);
    return { success: false, error: 'Could not check the code. Please try again.' };
  }
}
