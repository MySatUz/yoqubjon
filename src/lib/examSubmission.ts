import { prisma } from '@/lib/prisma';
import { answersMatch } from '@/lib/resultAnswers';
import { EXAM_TIME_GRACE_SECONDS, MAX_EXAM_DURATION_SECONDS } from '@/lib/examConfig';
import { estimateSatMathScore } from '@/lib/satScoring';
import { isAdminUser } from '@/lib/admin';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';

export class ExamSubmissionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExamSubmissionError';
    this.status = status;
  }
}

export interface ExamSubmissionInput {
  testId: string;
  answers: Record<string, string>;
  timeSpent: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

export function parseExamSubmissionBody(body: unknown): ExamSubmissionInput {
  if (!isPlainObject(body)) {
    throw new ExamSubmissionError('Invalid request body', 400);
  }

  const { testId, answers, timeSpent } = body;

  if (typeof testId !== 'string' || testId.trim().length === 0 || testId.length > 160) {
    throw new ExamSubmissionError('Invalid test id', 400);
  }

  if (!isPlainObject(answers)) {
    throw new ExamSubmissionError('Invalid answers', 400);
  }

  if (
    typeof timeSpent !== 'number' ||
    !Number.isInteger(timeSpent) ||
    timeSpent < 0 ||
    timeSpent > MAX_EXAM_DURATION_SECONDS + EXAM_TIME_GRACE_SECONDS
  ) {
    throw new ExamSubmissionError('Invalid time spent', 400);
  }

  const normalizedAnswers: Record<string, string> = {};

  for (const [key, value] of Object.entries(answers)) {
    if (key.length > 160) {
      throw new ExamSubmissionError('Invalid answer key', 400);
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value !== 'string' || value.length > 200) {
      throw new ExamSubmissionError('Invalid answer value', 400);
    }

    normalizedAnswers[key] = value.trim();
  }

  return {
    testId: testId.trim(),
    answers: normalizedAnswers,
    timeSpent,
  };
}

export async function createExamResult(
  userId: string,
  submission: ExamSubmissionInput
) {
  const test = await prisma.test.findUnique({
    where: { id: submission.testId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: { id: true, correctAnswer: true },
      },
    },
  });

  if (!test || test.questions.length === 0) {
    throw new ExamSubmissionError('Test not found', 404);
  }

  let adminCheck: Promise<boolean> | null = null;
  const getIsAdmin = () => {
    adminCheck ??= isAdminUser(userId);
    return adminCheck;
  };

  if (!test.visible && !(await getIsAdmin())) {
    throw new ExamSubmissionError('Test not found', 404);
  }

  if (submission.timeSpent > test.durationSeconds + EXAM_TIME_GRACE_SECONDS) {
    throw new ExamSubmissionError('Invalid time spent', 400);
  }

  if (Object.keys(submission.answers).length > test.questions.length * 2) {
    throw new ExamSubmissionError('Too many answers', 400);
  }

  if (!test.isFree) {
    const [subscription, hasSectionAccess, isAdmin] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
      userHasActiveSectionAccess(userId, null, test.collectionCategory),
      getIsAdmin(),
    ]);

    if (!subscription && !hasSectionAccess && !isAdmin) {
      throw new ExamSubmissionError('Subscription required', 403);
    }
  }

  let correctCount = 0;
  const processedAnswers: Record<string, {
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }> = {};

  test.questions.forEach((question, index) => {
    const userAnswer =
      submission.answers[question.id] ??
      submission.answers[index.toString()] ??
      '';
    const isCorrect = answersMatch(userAnswer, question.correctAnswer);

    if (isCorrect) {
      correctCount++;
    }

    processedAnswers[question.id] = {
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
    };
  });

  const score = estimateSatMathScore(correctCount, test.questions.length);

  const result = await prisma.result.create({
    data: {
      userId,
      testId: test.id,
      score,
      timeSpent: submission.timeSpent,
      answers: processedAnswers,
    },
  });

  return {
    success: true,
    resultId: result.id,
    score,
    correctCount,
    totalQuestions: test.questions.length,
  };
}
