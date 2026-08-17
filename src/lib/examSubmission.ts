import { prisma } from '@/lib/prisma';
import { answersMatch } from '@/lib/resultAnswers';
import { EXAM_TIME_GRACE_SECONDS, MAX_EXAM_DURATION_SECONDS } from '@/lib/examConfig';
import { estimateSatMathScore } from '@/lib/satScoring';
import { isAdminSessionUser } from '@/lib/admin';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';

/**
 * The session strategy is `jwt`, so a token stays valid after its user row is
 * gone. Such a submission used to reach `result.create` and die on
 * `P2003 Result_userId_fkey`, which the route handler turned into a 500 and the
 * student read as "Failed to submit". 401 lets the client tell an invalid
 * session apart from a broken server.
 */
const SESSION_USER_GONE_MESSAGE = 'Your account is no longer available. Please sign in again.';

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

/**
 * Only `P2003` (foreign key violated) can mean "the user row vanished", and the
 * error metadata does not name the column in every Prisma driver path, so the
 * account is re-checked instead of pattern-matching the constraint name. This
 * runs on the failure path only and covers the race where the row disappears
 * between the pre-flight check and the insert.
 */
async function asExamSubmissionError(error: unknown, userId: string) {
  const code = isPlainObject(error) ? error.code : undefined;
  if (code !== 'P2003') return error;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (user) return error;

  return new ExamSubmissionError(SESSION_USER_GONE_MESSAGE, 401);
}

export async function createExamResult(
  userId: string,
  submission: ExamSubmissionInput
) {
  // One read of the user row does three jobs: it decides the admin flag (same
  // two fields and the same predicate `isAdminUser` applies), it proves the
  // account still exists, and it supplies the email for the section-access
  // lookup - which otherwise repeats this exact read inside `resolveUserEmail`.
  // It is independent of the test, so both round-trips overlap; the no-op
  // handler keeps an early `throw` below from leaving an unhandled rejection.
  const userPromise = prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  userPromise.catch(() => {});

  const test = await prisma.test.findUnique({
    where: { id: submission.testId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: { id: true, correctAnswer: true, moduleIndex: true },
      },
    },
  });

  if (!test || test.questions.length === 0) {
    throw new ExamSubmissionError('Test not found', 404);
  }

  const user = await userPromise;
  const isAdmin = isAdminSessionUser(user);

  if (!test.visible && !isAdmin) {
    throw new ExamSubmissionError('Test not found', 404);
  }

  if (submission.timeSpent > test.durationSeconds + EXAM_TIME_GRACE_SECONDS) {
    throw new ExamSubmissionError('Invalid time spent', 400);
  }

  if (Object.keys(submission.answers).length > test.questions.length * 2) {
    throw new ExamSubmissionError('Too many answers', 400);
  }

  if (!test.isFree) {
    const [subscription, hasSectionAccess] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
      // The email is already in hand, so `resolveUserEmail` skips its own read.
      userHasActiveSectionAccess(userId, user?.email, test.collectionCategory),
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
    moduleIndex: number;
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
      moduleIndex: question.moduleIndex,
    };
  });

  const score = estimateSatMathScore(correctCount, test.questions.length);

  const resultData = {
    userId,
    testId: test.id,
    score,
    timeSpent: submission.timeSpent,
    answers: processedAnswers,
  };

  // Checked here, right before the only write, so every other status
  // (404/400/403/409) still comes from exactly the check it came from before -
  // the sole response this replaces is the 500 the failed insert produced.
  if (!user) {
    throw new ExamSubmissionError(SESSION_USER_GONE_MESSAGE, 401);
  }

  let result;

  try {
    result = isAdmin
      ? await prisma.result.create({ data: resultData })
      : await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${test.id})) IS NULL AS locked
        `;

        const currentTest = await tx.test.findUnique({
          where: { id: test.id },
          select: { maxAttempts: true },
        });

        if (!currentTest) {
          throw new ExamSubmissionError('Test not found', 404);
        }

        const attemptsUsed = await tx.result.count({
          where: {
            userId,
            testId: test.id,
          },
        });

        if (attemptsUsed >= currentTest.maxAttempts) {
          throw new ExamSubmissionError('Attempt limit reached', 409);
        }

        return tx.result.create({
          data: resultData,
        });
      });
  } catch (error) {
    // `ExamSubmissionError` (404/409 from inside the transaction) passes through
    // untouched; only a foreign-key failure is reinterpreted.
    throw await asExamSubmissionError(error, userId);
  }

  return {
    success: true,
    resultId: result.id,
    score,
    correctCount,
    totalQuestions: test.questions.length,
  };
}
