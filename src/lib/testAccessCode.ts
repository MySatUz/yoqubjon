import { prisma } from '@/lib/prisma';
import { ACCESS_CODE_LENGTH, ACCESS_CODE_PATTERN } from '@/lib/accessCodeFormat';

/**
 * Six digits give a million combinations, which a script exhausts in minutes
 * unless guesses are limited. Five wrong codes in a row pause the student for
 * ten minutes, so trying them all would take years.
 */
export const MAX_FAILED_CODE_ATTEMPTS = 5;
export const CODE_LOCKOUT_SECONDS = 10 * 60;

/** Keeps digits only, so "123 456" and "123-456" are read as the code they mean. */
function readDigits(value: unknown) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
}

/**
 * For the admin form. Empty means "no code" and comes back as null; anything
 * else has to be exactly six digits.
 */
export function normalizeAccessCode(value: unknown) {
  const code = readDigits(value);
  if (!code) return null;

  if (!ACCESS_CODE_PATTERN.test(code)) {
    throw new Error(`Access code must be exactly ${ACCESS_CODE_LENGTH} digits`);
  }

  return code;
}

/**
 * True when the student may open the test: it has no code, or the code they
 * entered earlier is still the current one. Changing the code on the test
 * therefore asks everyone again.
 */
export async function userHasUnlockedTest(
  userId: string,
  testId: string,
  accessCode: string | null | undefined
) {
  if (!accessCode) return true;

  const unlock = await prisma.testCodeUnlock.findUnique({
    where: { userId_testId: { userId, testId } },
    select: { code: true },
  });

  return unlock?.code === accessCode;
}

/**
 * Looser than `userHasUnlockedTest`, and only for submitting: any code the
 * student ever entered correctly counts. If the code is changed while someone
 * is in the middle of the test, their finished attempt must still be saved.
 * It cannot be used to skip the code, because the questions are only ever
 * served by the exam page, which applies the strict check.
 */
export async function userEverUnlockedTest(userId: string, testId: string) {
  const unlock = await prisma.testCodeUnlock.findUnique({
    where: { userId_testId: { userId, testId } },
    select: { code: true },
  });

  return Boolean(unlock?.code);
}

export type CodeAttemptResult =
  | { success: true }
  | { success: false; error: string };

function lockoutMessage(secondsLeft: number) {
  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
  return `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

/**
 * Checks one entered code and records the outcome. The whole step runs under a
 * per-student, per-test advisory lock: without it, parallel requests would all
 * read the same failure count and slip past the limit together.
 */
export async function submitTestAccessCode(
  userId: string,
  testId: string,
  input: unknown
): Promise<CodeAttemptResult> {
  const entered = readDigits(input);

  if (!ACCESS_CODE_PATTERN.test(entered)) {
    return { success: false, error: `Enter the ${ACCESS_CODE_LENGTH}-digit code.` };
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_advisory_xact_lock(hashtext(${`code:${userId}`}), hashtext(${testId})) IS NULL AS locked
    `;

    // Sequential on purpose: both run on the transaction's single connection.
    const test = await tx.test.findUnique({
      where: { id: testId },
      select: { accessCode: true },
    });
    const unlock = await tx.testCodeUnlock.findUnique({
      where: { userId_testId: { userId, testId } },
      select: { failedAttempts: true, lastFailedAt: true },
    });

    if (!test) {
      return { success: false, error: 'Test not found.' };
    }

    // The code was removed while the form was open: nothing left to check.
    if (!test.accessCode) {
      return { success: true };
    }

    const now = new Date();
    const secondsSinceFailure = unlock?.lastFailedAt
      ? (now.getTime() - unlock.lastFailedAt.getTime()) / 1000
      : Infinity;
    const lockoutOver = secondsSinceFailure >= CODE_LOCKOUT_SECONDS;
    // Once the pause has passed the student starts again from zero.
    const failedSoFar = lockoutOver ? 0 : unlock?.failedAttempts ?? 0;

    if (failedSoFar >= MAX_FAILED_CODE_ATTEMPTS) {
      return {
        success: false,
        error: lockoutMessage(CODE_LOCKOUT_SECONDS - secondsSinceFailure),
      };
    }

    if (entered === test.accessCode) {
      await tx.testCodeUnlock.upsert({
        where: { userId_testId: { userId, testId } },
        create: { userId, testId, code: entered },
        update: { code: entered, failedAttempts: 0, lastFailedAt: null },
      });

      return { success: true };
    }

    const failedAttempts = failedSoFar + 1;

    await tx.testCodeUnlock.upsert({
      where: { userId_testId: { userId, testId } },
      create: { userId, testId, failedAttempts, lastFailedAt: now },
      update: { failedAttempts, lastFailedAt: now },
    });

    if (failedAttempts >= MAX_FAILED_CODE_ATTEMPTS) {
      return { success: false, error: lockoutMessage(CODE_LOCKOUT_SECONDS) };
    }

    const left = MAX_FAILED_CODE_ATTEMPTS - failedAttempts;
    return {
      success: false,
      error: `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.`,
    };
  });
}
