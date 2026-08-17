import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { renderMathHtml } from '@/lib/renderMathHtml';

/**
 * Question content for the exam page, with all maths already rendered to HTML.
 *
 * Rendering a whole test costs ~80 ms of KaTeX on the server (46 questions /
 * 386 formulas measured), which is far too much to pay on every exam start, so
 * the result is kept in the Next data cache per test and invalidated by tag.
 * Every admin action that writes questions or replaces a test must call
 * `revalidateTag(examQuestionsCacheTag(testId), { expire: 0 })`.
 *
 * Only question content is cached here - never a permission check. Visibility,
 * attempt counts and subscriptions are read fresh in `/exam/[id]`.
 */
export const examQuestionsCacheTag = (testId: string) => `test-questions-${testId}`;

export type ExamQuestionHtml = {
  id: string;
  /** Pre-rendered HTML, safe to inject: see `renderMathHtml`. */
  contentHtml: string;
  /** One entry per answer choice; empty means a grid-in question. */
  optionsHtml: string[];
  imageUrl: string | null;
  moduleIndex: number;
};

function readOptions(options: unknown) {
  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === 'string')
    : [];
}

async function readExamQuestionsHtml(testId: string): Promise<ExamQuestionHtml[]> {
  const questions = await prisma.question.findMany({
    where: { testId },
    orderBy: { order: 'asc' },
    // Correct answers stay out of this cache entry: it is rendered into the
    // exam page, which the student can read.
    select: {
      id: true,
      content: true,
      options: true,
      imageUrl: true,
      moduleIndex: true,
    },
  });

  return questions.map((question) => ({
    id: question.id,
    contentHtml: renderMathHtml(question.content),
    optionsHtml: readOptions(question.options).map((option) => renderMathHtml(option)),
    imageUrl: question.imageUrl,
    moduleIndex: question.moduleIndex,
  }));
}

/**
 * `tags` is fixed when `unstable_cache` wraps a function, so the wrapper is
 * built per test - the documented way to get a per-argument tag. `testId` is a
 * closure variable, so it also goes into `keyParts`, as the docs require.
 */
function loadExamQuestionsHtml(testId: string) {
  return unstable_cache(
    () => readExamQuestionsHtml(testId),
    ['exam-questions-html', testId],
    { tags: [examQuestionsCacheTag(testId)], revalidate: 3600 }
  )();
}

// `cache()` collapses repeats inside one request, `unstable_cache` across requests.
export const getExamQuestionsHtml = cache(
  async (testId: string): Promise<ExamQuestionHtml[]> => loadExamQuestionsHtml(testId)
);
