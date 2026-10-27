import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getShownQuestions } from '@/lib/questionSource';
import { gradeAnswer } from '@/lib/resultAnswers';
import { EXAM_TIME_GRACE_SECONDS, MAX_EXAM_DURATION_SECONDS } from '@/lib/examConfig';
import { estimateSatMathScore } from '@/lib/satScoring';
import { isAdminSessionUser } from '@/lib/admin';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';
import { userEverUnlockedTest } from '@/lib/testAccessCode';

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
  /** Null from clients older than the field: they get no duplicate check. */
  attemptId: string | null;
  answers: Record<string, string>;
  timeSpent: number;
  /** The account that started the attempt in this browser; null for attempts saved before owners existed. */
  ownerId: string | null;
}

/**
 * The attempt was started by another account on this computer - one student
 * signed out, the next signed in elsewhere in the same browser, and the first
 * one's open exam tab finished. Saving it would file one student's answers
 * under the other's name.
 */
const ATTEMPT_OF_ANOTHER_ACCOUNT_MESSAGE =
  'This test was started by another account on this computer, so it was not saved. The page will reload.';

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

  const { testId, attemptId, answers, timeSpent, ownerId } = body;

  if (typeof testId !== 'string' || testId.trim().length === 0 || testId.length > 160) {
    throw new ExamSubmissionError('Invalid test id', 400);
  }

  if (
    attemptId !== undefined &&
    attemptId !== null &&
    (typeof attemptId !== 'string' || attemptId.trim().length === 0 || attemptId.length > 160)
  ) {
    throw new ExamSubmissionError('Invalid attempt id', 400);
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

  if (ownerId !== undefined && ownerId !== null && (typeof ownerId !== 'string' || ownerId.length > 160)) {
    throw new ExamSubmissionError('Invalid owner', 400);
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
    attemptId: typeof attemptId === 'string' ? attemptId.trim() : null,
    answers: normalizedAnswers,
    timeSpent,
    ownerId: typeof ownerId === 'string' ? ownerId : null,
  };
}

const SAVED_RESULT_SELECT = {
  id: true,
  testId: true,
  score: true,
  correctCount: true,
} satisfies Prisma.ResultSelect;

/**
 * The result this attempt already filed, if any. An attempt is sent again when
 * the page reloads while it is out, from a second tab, or as a retry after the
 * response was lost; each of those used to add a row and use up an attempt.
 *
 * The same id on another test is not a resend - a stale client sending one
 * attempt's id with the next test - and filing it would be a result the
 * student never submitted.
 */
async function findFiledAttempt(
  db: Prisma.TransactionClient,
  userId: string,
  attemptId: string | null,
  testId: string
) {
  if (!attemptId) return null;

  const filed = await db.result.findFirst({
    where: { userId, attemptId },
    select: SAVED_RESULT_SELECT,
  });

  if (filed && filed.testId !== testId) {
    throw new ExamSubmissionError('This attempt was already submitted for another test', 409);
  }

  return filed;
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
  if (submission.ownerId !== null && submission.ownerId !== userId) {
    throw new ExamSubmissionError(ATTEMPT_OF_ANOTHER_ACCOUNT_MESSAGE, 409);
  }

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

  // A copy is graded against its original's questions, which it shows instead
  // of having its own; both selections ride on the one query.
  const test = await prisma.test.findUnique({
    where: { id: submission.testId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
        select: { id: true, correctAnswer: true, moduleIndex: true },
      },
      questionSource: {
        select: {
          questions: {
            orderBy: { order: 'asc' },
            select: { id: true, correctAnswer: true, moduleIndex: true },
          },
        },
      },
    },
  });
  const questions = test ? getShownQuestions(test) : [];

  if (!test || questions.length === 0) {
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

  if (Object.keys(submission.answers).length > questions.length * 2) {
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

  if (test.accessCode && !isAdmin && !await userEverUnlockedTest(userId, test.id)) {
    // Shown to the student as is, in the exam's "not sent" dialog: the code
    // was set on the test while they were sitting it, and entering it is the
    // only way past.
    throw new ExamSubmissionError('This test now needs a test code. Reload the page and enter the code from your teacher', 403);
  }

  let earnedCredit = 0;
  const processedAnswers: Record<string, {
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    credit: number;
    moduleIndex: number;
  }> = {};

  questions.forEach((question, index) => {
    const userAnswer =
      submission.answers[question.id] ??
      submission.answers[index.toString()] ??
      '';
    const { isCorrect, credit } = gradeAnswer(userAnswer, question.correctAnswer);

    earnedCredit += credit;

    processedAnswers[question.id] = {
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      credit,
      moduleIndex: question.moduleIndex,
    };
  });

  // Fractional once a multi-select question is only partly right. Rounded to
  // two decimals so the stored total is the number the review pages show and
  // not the sum of a dozen binary fractions.
  const correctCount = Math.round(earnedCredit * 100) / 100;
  const score = estimateSatMathScore(correctCount, questions.length);

  const resultData = {
    userId,
    testId: test.id,
    attemptId: submission.attemptId,
    score,
    // Written on every submission. It used to be computed here and dropped, so
    // every row since the column was added stored NULL and the olympiad
    // ranking - which cannot rank a NULL - skipped the attempt entirely.
    correctCount,
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
      ? await findFiledAttempt(prisma, userId, submission.attemptId, test.id)
        ?? await prisma.result.create({ data: resultData, select: SAVED_RESULT_SELECT })
      : await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${test.id})) IS NULL AS locked
        `;

        // Before the attempt count: a resend of the student's last allowed
        // attempt must get its result back, not "Attempt limit reached". The
        // lock makes a resend of the same test wait for the first send.
        const filed = await findFiledAttempt(tx, userId, submission.attemptId, test.id);
        if (filed) return filed;

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
          select: SAVED_RESULT_SELECT,
        });
      });
  } catch (error) {
    // Two sends of one attempt that the lock does not order - the admin path
    // takes none, and the lock is per test - both found nothing and raced to
    // insert. The index let one through; that row is the answer to both.
    const filed = isPlainObject(error) && error.code === 'P2002'
      ? await findFiledAttempt(prisma, userId, submission.attemptId, test.id)
      : null;
    if (!filed) {
      // `ExamSubmissionError` (404/409 from inside the transaction) passes
      // through untouched; only a foreign-key failure is reinterpreted.
      throw await asExamSubmissionError(error, userId);
    }
    result = filed;
  }

  // From the row rather than this request's grading, so a resend reports what
  // was filed.
  return {
    success: true,
    resultId: result.id,
    score: result.score,
    correctCount: result.correctCount,
    totalQuestions: questions.length,
  };
}
