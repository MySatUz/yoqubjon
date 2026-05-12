'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { answersMatch } from '@/lib/resultAnswers';

export async function submitExam(testId: string, answers: Record<string, string>, timeSpent: number) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: { id: true, correctAnswer: true }
      }
    }
  });

  if (!test || test.questions.length === 0) {
    throw new Error('Test not found or has no questions');
  }

  if (!test.isFree) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!subscription) {
      throw new Error('Subscription required');
    }
  }

  const questions = test.questions;
  let correctCount = 0;
  
  questions.forEach(q => {
    const userAnswer = answers[q.id];
    if (answersMatch(userAnswer || '', q.correctAnswer)) {
      correctCount++;
    }
  });

  // Calculate scaled score
  // Let's assume the test has `questions.length` questions, and the max score is 800
  const rawScore = correctCount;
  const maxScore = 800;
  const score = Math.round((rawScore / questions.length) * maxScore);

  // Create result record
  const result = await prisma.result.create({
    data: {
      userId: session.user.id,
      testId,
      score,
      timeSpent,
      answers, // stores selected answers
    }
  });

  // server-serialization: ONLY return safe data (no correct answers)
  return {
    success: true,
    resultId: result.id,
    score,
  };
}
