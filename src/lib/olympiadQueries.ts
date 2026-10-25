import { prisma } from '@/lib/prisma';
import { questionsShownBy } from '@/lib/questionSource';
import { getTotalDurationSeconds } from '@/lib/examModules';
import {
  rankOlympiadAttempts,
  readOlympiadWindow,
  type OlympiadResults,
  type OlympiadWindow,
} from '@/lib/olympiad';

/** Reads one olympiad's attempts and ranks them. */
export async function getOlympiadResults(
  testId: string,
  window: OlympiadWindow
): Promise<OlympiadResults> {
  const [attempts, totalQuestions] = await Promise.all([
    prisma.result.findMany({
      // Only attempts submitted inside the window count; the entrance closes one
      // test length early so nothing in progress is cut off by this boundary.
      where: {
        testId,
        createdAt: { gte: window.startsAt, lt: window.endsAt },
      },
      select: {
        userId: true,
        correctCount: true,
        score: true,
        timeSpent: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.question.count({ where: questionsShownBy(testId) }),
  ]);

  const standings = rankOlympiadAttempts(attempts);

  return { standings, totalQuestions, participants: standings.length };
}

/**
 * Reads the window off a test and returns its total run time in one place.
 * `description` and `collectionCategory` are what getTestCategory reads, so the
 * olympiad page can link back to its Practice collection without a second read,
 * and check access to it.
 */
export async function getOlympiadTest(testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      title: true,
      description: true,
      collectionCategory: true,
      // The exam page's gates, so the olympiad page offers Start only where
      // the exam would open: a hidden test is not there for a student at all.
      visible: true,
      isFree: true,
      maxAttempts: true,
      durationSeconds: true,
      moduleDurations: true,
      olympiadStartsAt: true,
      olympiadEndsAt: true,
    },
  });

  if (!test) return null;

  const window = readOlympiadWindow(test);
  if (!window) return null;

  return { test, window, totalDurationSeconds: getTotalDurationSeconds(test) };
}
