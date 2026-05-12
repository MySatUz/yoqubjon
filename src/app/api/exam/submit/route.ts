import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { answersMatch } from '@/lib/resultAnswers';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testId, answers, timeSpent } = await req.json();

    if (
      typeof testId !== 'string' ||
      !answers ||
      typeof answers !== 'object' ||
      Array.isArray(answers)
    ) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const submittedAnswers = answers as Record<string, unknown>;

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: { id: true, correctAnswer: true },
        },
      },
    });

    if (!test || test.questions.length === 0) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
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
        return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
      }
    }

    const questions = test.questions;
    let correctCount = 0;
    const processedAnswers: Record<string, {
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }> = {};

    questions.forEach((q, index) => {
      const rawAnswer = submittedAnswers[q.id] ?? submittedAnswers[index.toString()];
      const userAnswer = typeof rawAnswer === 'string' ? rawAnswer : '';
      const isCorrect = answersMatch(userAnswer, q.correctAnswer);
      
      if (isCorrect) correctCount++;
      
      processedAnswers[q.id] = {
        userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect
      };
    });

    // Simple scoring logic for now (can be improved with SAT scaling)
    const score = Math.round((correctCount / questions.length) * 800);

    const result = await prisma.result.create({
      data: {
        userId: session.user.id,
        testId,
        score,
        timeSpent,
        answers: processedAnswers,
      }
    });

    return NextResponse.json({ 
      success: true, 
      resultId: result.id,
      score,
      correctCount,
      totalQuestions: questions.length
    });

  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
