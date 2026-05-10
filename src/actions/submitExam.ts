'use server';

import { prisma } from '@/lib/prisma';

export async function submitExam(testId: string, userId: string, answers: Record<string, string>, timeSpent: number) {
  // Use `server-auth-actions` pattern: verify user is authenticated here
  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Fetch all questions for this test to grade them
  const questions = await prisma.question.findMany({
    where: { testId },
    select: { id: true, correctAnswer: true }
  });

  if (!questions || questions.length === 0) {
    throw new Error('Test not found or has no questions');
  }

  let correctCount = 0;
  
  questions.forEach(q => {
    const userAnswer = answers[q.id];
    if (userAnswer === q.correctAnswer) {
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
      userId,
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
