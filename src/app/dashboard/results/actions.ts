'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { questionsShownBy } from '@/lib/questionSource';
import { renderMathHtml } from '@/lib/renderMathHtml';
import { normalizeStoredAnswer } from '@/lib/resultAnswers';

/**
 * One question of a finished attempt, fetched on demand.
 *
 * The result page deliberately renders none of this. Question text, diagrams
 * and answer keys only ever leave the server one question at a time, through
 * this action, so the page a student has open never holds a printable copy of
 * the test — `Ctrl+P` on it produces a score summary and nothing else.
 */
export type RevealedQuestion = {
  /** Pre-rendered HTML, safe to inject: see `renderMathHtml`. */
  contentHtml: string;
  imageUrl: string | null;
  videoUrl: string | null;
  userAnswerHtml: string;
  /** Only sent for a question the student did not fully get right. */
  correctAnswerHtml: string | null;
  isCorrect: boolean;
  credit: number;
};

export type RevealQuestionResponse =
  | { question: RevealedQuestion; error?: undefined }
  | { question?: undefined; error: string };

/** Both ids are uuids; anything longer is not worth a database round-trip. */
const MAX_ID_LENGTH = 160;

async function readRevealedRecords(userId: string, resultId: string, questionId: string) {
  // `userId` in the filter, not a check afterwards: a result belonging to
  // somebody else must be indistinguishable from one that does not exist.
  const result = await prisma.result.findFirst({
    where: { id: resultId, userId },
    select: { testId: true, answers: true },
  });

  if (!result) return { result: null, question: null };

  // Scoped to the questions the attempt's test shows - its own, or for a copy
  // its original's - so a question id from another test cannot be read through
  // somebody's own result.
  const question = await prisma.question.findFirst({
    where: { id: questionId, ...questionsShownBy(result.testId) },
    select: {
      id: true,
      order: true,
      content: true,
      imageUrl: true,
      videoUrl: true,
      correctAnswer: true,
    },
  });

  return { result, question };
}

export async function revealResultQuestion(
  resultId: string,
  questionId: string
): Promise<RevealQuestionResponse> {
  if (
    typeof resultId !== 'string' ||
    typeof questionId !== 'string' ||
    resultId.length === 0 ||
    questionId.length === 0 ||
    resultId.length > MAX_ID_LENGTH ||
    questionId.length > MAX_ID_LENGTH
  ) {
    return { error: 'Invalid request.' };
  }

  const session = await auth();

  if (!session?.user?.id) {
    return { error: 'Your session has expired. Please sign in again.' };
  }

  const userId = session.user.id;

  // A thrown error would reach the client as a rejected action, so a database
  // hiccup is answered as data the review can show and retry.
  let records;
  try {
    records = await readRevealedRecords(userId, resultId, questionId);
  } catch (error) {
    console.error('Reveal Result Question Error:', error);
    return { error: 'Could not load this question. Please try again.' };
  }

  if (!records.result) {
    return { error: 'Result not found.' };
  }

  const { result, question } = records;

  if (!question) {
    return { error: 'Question not found.' };
  }

  const storedAnswers = result.answers as Record<string, unknown>;
  const answer = normalizeStoredAnswer(
    // Attempts written before answers were keyed by question id are keyed by
    // the question's zero-based position instead.
    storedAnswers[question.id] ?? storedAnswers[(question.order - 1).toString()],
    question.correctAnswer
  );

  return {
    question: {
      contentHtml: renderMathHtml(question.content),
      imageUrl: question.imageUrl,
      videoUrl: question.videoUrl,
      userAnswerHtml: renderMathHtml(answer.userAnswer),
      // A question the student got right needs no key, and not sending one is
      // one less answer on the wire.
      correctAnswerHtml: answer.isCorrect ? null : renderMathHtml(answer.correctAnswer),
      isCorrect: answer.isCorrect,
      credit: answer.credit,
    },
  };
}
