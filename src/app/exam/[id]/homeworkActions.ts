'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { questionsShownBy } from '@/lib/questionSource';
import { gradeAnswer } from '@/lib/resultAnswers';
import {
  canDoHomework,
  normalizeHomeworkAnswer,
  toHomeworkVerdict,
  type HomeworkVerdict,
} from '@/lib/homework';

export type CheckHomeworkResponse =
  | { verdict: HomeworkVerdict; error?: undefined }
  | { verdict?: undefined; error: string };

/** Both ids are uuids; anything longer is not worth a database round trip. */
const MAX_ID_LENGTH = 160;

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

/**
 * Checks one homework answer and keeps it. The first answer to a question
 * stands: a second send - a double click, a second tab - gets the verdict
 * already stored, never a new one. Failures come back as data the screen
 * shows beside the question, so nothing is thrown at the client.
 */
export async function checkHomeworkAnswer(
  testId: string,
  questionId: string,
  answer: string
): Promise<CheckHomeworkResponse> {
  if (!isId(testId) || !isId(questionId)) {
    return { error: 'Question not found.' };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Your session has expired. Sign in again; your earlier answers are saved.' };
  }
  const userId = session.user.id;

  try {
    if (!(await canDoHomework(userId, session.user.email, testId))) {
      return { error: 'This homework is not open to you any more. Reload the page.' };
    }

    // Scoped to the questions this test shows - its own, or a copy's
    // original's - so an id from another test cannot be checked through it.
    const question = await prisma.question.findFirst({
      where: { id: questionId, ...questionsShownBy(testId) },
      select: { correctAnswer: true, options: true },
    });
    if (!question) {
      return { error: 'This question was removed from the homework. Reload the page.' };
    }

    const stored = normalizeHomeworkAnswer(answer, question);
    if (stored === null) {
      return { error: 'That answer cannot be checked. Choose an option or type a number.' };
    }

    const graded = gradeAnswer(stored, question.correctAnswer);
    const where = { userId_testId_questionId: { userId, testId, questionId } };
    // `update: {}` keeps the first answer: upsert only writes on a miss.
    const row = await prisma.homeworkAnswer.upsert({
      where,
      create: { userId, testId, questionId, answer: stored, isCorrect: graded.isCorrect, credit: graded.credit },
      update: {},
      select: { answer: true, isCorrect: true, credit: true },
    });

    return { verdict: toHomeworkVerdict(row, question) };
  } catch (error: unknown) {
    console.error('Check Homework Answer Error:', error);
    return { error: 'Could not check your answer. Try again.' };
  }
}

/** Clears the student's answers on this homework, so every question opens again. */
export async function startHomeworkOver(testId: string): Promise<{ ok: true; error?: undefined } | { ok?: undefined; error: string }> {
  if (!isId(testId)) {
    return { error: 'Homework not found.' };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Your session has expired. Sign in again; your answers are still saved.' };
  }

  try {
    await prisma.homeworkAnswer.deleteMany({ where: { userId: session.user.id, testId } });
    return { ok: true };
  } catch (error: unknown) {
    console.error('Start Homework Over Error:', error);
    return { error: 'Could not clear your answers. They are still saved. Try again.' };
  }
}
