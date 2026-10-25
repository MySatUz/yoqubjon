'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { questionsShownBy } from '@/lib/questionSource';
import { renderMathHtml } from '@/lib/renderMathHtml';
import { normalizeStoredAnswer, parseAnswerLetters } from '@/lib/resultAnswers';
import { optionAsMath } from '@/components/exam/optionMath';
import { formatReviewOpens, getReviewOpensAt } from '@/lib/olympiad';
import { getViewerAccess } from '@/lib/studentView';

/**
 * One question of a finished attempt, fetched on demand.
 *
 * The result page deliberately renders none of this. Question text, diagrams
 * and answer keys only ever leave the server one question at a time, through
 * this action, so the page a student has open never holds a printable copy of
 * the test — `Ctrl+P` on it produces a score summary and nothing else.
 *
 * No explanation and no explanation video: the owner's rule is that students
 * see the correct answer and their own, not a worked solution. The admin
 * editor keeps both fields; they are simply never read here, so they cannot
 * reach a student's browser.
 */
export type RevealedQuestion = {
  /** Pre-rendered HTML, safe to inject: see `renderMathHtml`. */
  contentHtml: string;
  imageUrl: string | null;
  /**
   * The answer choices, A first, so the review can show the student what they
   * picked and what was right in the words of the question. Empty for a
   * grid-in question.
   */
  optionsHtml: string[];
  /** Letters the student picked; empty for grid-in or no answer. */
  userLetters: string[];
  /**
   * Letters of the key. For a question answered right these are the student's
   * own letters, so nothing is sent that the student did not already pick.
   */
  correctLetters: string[];
  userAnswerHtml: string;
  /** Only sent for a question the student did not fully get right. */
  correctAnswerHtml: string | null;
  isCorrect: boolean;
  credit: number;
};

export type RevealQuestionResponse =
  | { question: RevealedQuestion; error?: undefined; closed?: undefined }
  /**
   * `closed`: the test is an olympiad that has not ended, so nothing about its
   * questions is sent yet; `error` then says when they open.
   */
  | { question?: undefined; error: string; closed?: boolean };

/** Both ids are uuids; anything longer is not worth a database round-trip. */
const MAX_ID_LENGTH = 160;

async function readRevealedRecords(userId: string, resultId: string, questionId: string) {
  // `userId` in the filter, not a check afterwards: a result belonging to
  // somebody else must be indistinguishable from one that does not exist.
  const [result, viewer] = await Promise.all([
    prisma.result.findFirst({
      where: { id: resultId, userId },
      select: {
        testId: true,
        answers: true,
        test: { select: { olympiadStartsAt: true, olympiadEndsAt: true } },
      },
    }),
    getViewerAccess(userId),
  ]);

  if (!result) return { result: null, question: null, opensAt: null };

  // An olympiad's questions stay closed until its window has ended - the
  // question text as much as the key (getReviewOpensAt) - so this returns
  // before the question is even read. An admin in student view waits too.
  const opensAt = viewer.isAdmin ? null : getReviewOpensAt(result.test);
  if (opensAt) return { result, question: null, opensAt };

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
      correctAnswer: true,
      options: true,
    },
  });

  return { result, question, opensAt: null };
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

  const { result, question, opensAt } = records;

  if (opensAt) {
    return { error: formatReviewOpens(opensAt), closed: true };
  }

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

  const options = Array.isArray(question.options)
    ? question.options.filter((option): option is string => typeof option === 'string')
    : [];
  const userLetters = options.length > 0 ? parseAnswerLetters(answer.userAnswer) ?? [] : [];

  return {
    question: {
      contentHtml: renderMathHtml(question.content),
      imageUrl: question.imageUrl,
      // A choice that is only a number is set in KaTeX, by optionMath's one
      // rule for every place a choice is shown, so the review reads like the
      // test the student sat.
      optionsHtml: options.map((option) => renderMathHtml(optionAsMath(option))),
      userLetters,
      correctLetters:
        options.length === 0
          ? []
          : answer.isCorrect
            ? userLetters
            : parseAnswerLetters(answer.correctAnswer) ?? [],
      userAnswerHtml: renderMathHtml(answer.userAnswer),
      // A question the student got right needs no key, and not sending one is
      // one less answer on the wire.
      correctAnswerHtml: answer.isCorrect ? null : renderMathHtml(answer.correctAnswer),
      isCorrect: answer.isCorrect,
      credit: answer.credit,
    },
  };
}
