import { prisma } from '@/lib/prisma';
import { renderMathHtml } from '@/lib/renderMathHtml';
import { formatAnswerLetters, parseAnswerLetters } from '@/lib/resultAnswers';
import { getViewerAccess } from '@/lib/studentView';
import { userHasActiveSectionAccess } from '@/lib/sectionAccess';
import { userHasUnlockedTest } from '@/lib/testAccessCode';

/**
 * Homework (Test.homework): one list of questions with no clock and no finish.
 * Every answer is checked here on the server the moment the student chooses
 * it, and kept as a `HomeworkAnswer`, so the key never reaches the browser
 * before the question is answered and the student comes back to where they
 * were on any device. A question is answered once; Start over deletes the
 * student's answers for the test. No `Result` is written.
 */

/** A checked answer, as the homework screen draws it. */
export type HomeworkVerdict = {
  /** As stored: a letter, letters joined by commas, or the grid-in value. */
  answer: string;
  /** The answer typeset, for a grid-in question. Pre-rendered, safe to inject (renderMathHtml). */
  answerHtml: string;
  isCorrect: boolean;
  /** 0..1; only a multi-select question lands between. */
  credit: number;
  /** The key's letters, on a choice question; empty for a grid-in one. */
  correctLetters: string[];
  /**
   * The key in words, where letters cannot show it: a grid-in question not
   * fully right, or a choice question whose key names no letter.
   */
  correctAnswerHtml: string | null;
};

/** The longest answer worth a database round trip: a grid-in value is 6 characters at most. */
const MAX_ANSWER_LENGTH = 32;

function readOptionCount(options: unknown) {
  return Array.isArray(options) ? options.filter((option) => typeof option === 'string').length : 0;
}

export function toHomeworkVerdict(
  row: { answer: string; isCorrect: boolean; credit: number },
  question: { correctAnswer: string; options: unknown }
): HomeworkVerdict {
  const isChoice = readOptionCount(question.options) > 0;
  const keyLetters = isChoice ? parseAnswerLetters(question.correctAnswer) ?? [] : [];

  return {
    answer: row.answer,
    answerHtml: isChoice ? '' : renderMathHtml(row.answer),
    isCorrect: row.isCorrect,
    credit: row.credit,
    correctLetters: keyLetters,
    // The question is closed once answered, so the key is no secret any more;
    // a right grid-in answer already says it.
    correctAnswerHtml:
      (isChoice && keyLetters.length === 0) || (!isChoice && !row.isCorrect)
        ? renderMathHtml(question.correctAnswer)
        : null,
  };
}

/**
 * The answer as it will be stored, or null when it cannot be an answer to
 * this question: letters only from the question's own choices (one for a
 * single-choice key), a grid-in value in the field's characters.
 */
export function normalizeHomeworkAnswer(
  value: unknown,
  question: { correctAnswer: string; options: unknown }
): string | null {
  if (typeof value !== 'string' || value.length > MAX_ANSWER_LENGTH) return null;

  const optionCount = readOptionCount(question.options);
  if (optionCount === 0) {
    const text = value.trim().replace(/[−–—]/g, '-');
    return /^-?[0-9./]+$/.test(text) ? text : null;
  }

  const letters = parseAnswerLetters(value);
  if (!letters) return null;
  const lastLetter = String.fromCharCode(64 + optionCount);
  if (letters.some((letter) => letter > lastLetter)) return null;

  const keyLetters = parseAnswerLetters(question.correctAnswer);
  const isMultiSelect = keyLetters !== null && new Set(keyLetters).size >= 2;
  if (!isMultiSelect && new Set(letters).size !== 1) return null;

  return formatAnswerLetters(letters);
}

/** The student's checked answers on this test, by question id. */
export async function readHomeworkVerdicts(userId: string, testId: string) {
  const rows = await prisma.homeworkAnswer.findMany({
    where: { userId, testId },
    select: {
      questionId: true,
      answer: true,
      isCorrect: true,
      credit: true,
      question: { select: { correctAnswer: true, options: true } },
    },
  });

  return Object.fromEntries(
    rows.map((row) => [row.questionId, toHomeworkVerdict(row, row.question)])
  ) as Record<string, HomeworkVerdict>;
}

/**
 * The exam page's gates, for the actions that check and clear answers: the
 * test is homework, visible, open to this student (free, Premium, course
 * access, or an admin) and, if it has a test code, unlocked by them. An admin
 * in student view passes only what a student would.
 */
export async function canDoHomework(userId: string, email: string | null | undefined, testId: string) {
  const [test, viewer, subscription] = await Promise.all([
    prisma.test.findUnique({
      where: { id: testId },
      select: { homework: true, visible: true, isFree: true, collectionCategory: true, accessCode: true },
    }),
    getViewerAccess(userId),
    prisma.subscription.findFirst({
      where: { userId, isActive: true, expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);

  if (!test || !test.homework) return false;
  if (viewer.isAdmin) return true;
  if (!test.visible) return false;

  if (
    !test.isFree &&
    !subscription &&
    !viewer.simulatesSubscription &&
    !(await userHasActiveSectionAccess(userId, email, test.collectionCategory))
  ) {
    return false;
  }

  return !test.accessCode || userHasUnlockedTest(userId, testId, test.accessCode);
}
