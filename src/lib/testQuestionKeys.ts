import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { examQuestionsCacheTag } from '@/lib/examQuestions';
import { questionsShownBy } from '@/lib/questionSource';

/**
 * Every question a test shows, with its answer key, kept in the Next data
 * cache per test: the review reveals one question at a time, a homework
 * answer is graded and the Practice cards count mistakes, and each of those
 * used to read the questions again. Prisma Postgres bills every read, and the
 * questions change only when an admin edits them.
 *
 * SERVER ONLY. The key is in here, so nothing from this module goes to the
 * browser whole: the review still sends one question per request, and only
 * once its review is open (`revealResultQuestion`).
 *
 * It shares the exam's tag, `examQuestionsCacheTag`, which every write of a
 * test's questions already expires - for the test and for each of its copies,
 * which cache their original's questions under their own id.
 *
 * `options` is the stored JSON as it is; the readers filter it.
 */
export type TestQuestionKey = {
  id: string;
  order: number;
  moduleIndex: number;
  content: string;
  imageUrl: string | null;
  correctAnswer: string;
  options: unknown;
};

async function readTestQuestionKeys(testId: string): Promise<TestQuestionKey[]> {
  return prisma.question.findMany({
    where: questionsShownBy(testId),
    orderBy: { order: 'asc' },
    select: {
      id: true,
      order: true,
      moduleIndex: true,
      content: true,
      imageUrl: true,
      correctAnswer: true,
      options: true,
    },
  });
}

/** Per test, as `loadExamQuestionsHtml` builds its wrapper: the tag is fixed when the wrapper is made. */
function loadTestQuestionKeys(testId: string) {
  return unstable_cache(
    () => readTestQuestionKeys(testId),
    ['test-question-keys', 'v1', testId],
    { tags: [examQuestionsCacheTag(testId)], revalidate: 3600 }
  )();
}

// `cache()` collapses repeats inside one request, `unstable_cache` across requests.
export const getTestQuestionKeys = cache(
  async (testId: string): Promise<TestQuestionKey[]> => loadTestQuestionKeys(testId)
);

/** One question a test shows, or null - an id from another test is not found here. */
export async function findTestQuestionKey(testId: string, questionId: string) {
  return (await getTestQuestionKeys(testId)).find((question) => question.id === questionId) ?? null;
}
