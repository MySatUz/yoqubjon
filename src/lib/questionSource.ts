import type { Prisma } from '@prisma/client';

/**
 * A copy of a test has no questions of its own: it shows those of the test it
 * was copied from, `Test.questionSourceId`. The text and the images are stored
 * once, so an edit made through either test shows in both. Deleting the
 * original hands its rows to its oldest copy, `copyTakingOver` below, and the
 * other copies show them from there.
 *
 * Every read of a test's questions goes through one of the two helpers below;
 * reading `testId` directly would give a copy an empty paper.
 */

/**
 * Orders an original's copies so that the first one takes over its questions
 * when the original is deleted: the oldest, and the id breaks a tie. The
 * delete action and its confirmation read the same order, so the dialog names
 * the copy that is then chosen.
 */
export const copyTakingOver = [
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.TestOrderByWithRelationInput[];

/** Where-clause for the questions a test shows: its own, or its original's. */
export function questionsShownBy(testId: string): Prisma.QuestionWhereInput {
  return {
    OR: [
      { testId },
      { test: { questionCopies: { some: { id: testId } } } },
    ],
  };
}

/**
 * For a test read together with its original's questions, in one query:
 * `questions` plus `questionSource: { select: { questions } }`.
 */
export function getShownQuestions<Question>(test: {
  questions: Question[];
  questionSource: { questions: Question[] } | null;
}) {
  return test.questionSource?.questions ?? test.questions;
}
