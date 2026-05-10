import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testId, answers, timeSpent } = await req.json();

    if (!testId || !answers) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Fetch questions to calculate score
    const questions = await prisma.question.findMany({
      where: { testId },
      select: { id: true, correctAnswer: true }
    });

    let correctCount = 0;
    const processedAnswers: Record<string, any> = {};

    questions.forEach((q) => {
      const userAnswer = answers[q.id] || answers[questions.indexOf(q).toString()]; // Support both ID and Index keys
      const isCorrect = userAnswer?.toString().trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
      
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
