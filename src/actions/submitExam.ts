'use server';

import { auth } from '@/auth';
import { createExamResult, parseExamSubmissionBody } from '@/lib/examSubmission';

export async function submitExam(testId: string, answers: Record<string, string>, timeSpent: number) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const submission = parseExamSubmissionBody({ testId, answers, timeSpent });
  return createExamResult(session.user.id, submission);
}
