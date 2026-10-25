import { daysBetweenKeys, tashkentDateKey, utcDateKey } from '@/components/admin/courses/accessPlan';
import { formatModuleBadge } from '@/lib/examModules';
import { formatDate } from '@/lib/formatDate';
import { formatDuration } from '@/lib/olympiad';
import { MIN_QUESTIONS_FOR_SCORE, hasScoreEstimate } from '@/lib/scoreDisplay';
import { normalizeStoredAnswer } from '@/lib/resultAnswers';

/**
 * What the Practice home shows above the catalog: the student's courses and
 * where they stand in each.
 *
 * A student here usually studies one course - a section opened for them by
 * email for one to three months, the rest of the catalog hidden - so progress
 * is counted per section, never across them: a score in one course says
 * nothing about another. Courses come first in this order: sections the
 * student was granted (newest grant first), then sections they have practised
 * in (most recent first). Two at most; the full list of sections stays below.
 */

const MAX_COURSES = 2;
const LINE_POINTS = 8;

export type OverviewCollection = { value: string; label: string; description?: string | null };

export type OverviewTest = {
  id: string;
  title: string;
  category: string | null;
  attemptsUsed: number;
  maxAttempts: number;
  questionCount: number;
  canAccess: boolean;
  isFree: boolean;
  isOlympiad: boolean;
  durationSeconds: number;
  moduleDurations: number[];
};

export type OverviewResult = {
  id: string;
  testId: string;
  score: number;
  correctCount: number | null;
  createdAt: Date;
};

export type OverviewGrant = { category: string; expiresAt: Date | null; grantedAt: Date };

export type CourseSummary = {
  category: string;
  label: string;
  description: string | null;
  /** Set only for a granted course: how long the access lasts. */
  access: { until: string | null; daysLeft: number | null } | null;
  testsTotal: number;
  testsDone: number;
  nextTest: { id: string; title: string; facts: string } | null;
  lastResult: {
    id: string;
    title: string;
    score: number | null;
    date: string;
    /** Questions not fully right, counted as the result page counts its mistakes. */
    toReview: number;
    /** An olympiad that has not ended: its questions are closed (getReviewOpensAt). */
    reviewClosed: boolean;
  } | null;
  /** Latest score of each full-length test, oldest first. */
  line: number[];
  best: number | null;
  /** Every test of the course, so the client can match an unfinished attempt to it. */
  tests: { id: string; title: string }[];
};

export type PracticeOverview = {
  courses: CourseSummary[];
  /**
   * A brand-new student's first step: no course and nothing taken yet.
   * `hasScore`: long enough for a score estimate, so the card only promises one
   * when the test gives one.
   */
  startHere: { id: string; title: string; facts: string; isFree: boolean; hasScore: boolean } | null;
};

/** What the last result's review needs that its row does not carry: read for that one result. */
export type LastResultReview = { mistakes: number; closed: boolean };

/**
 * The result page's count of mistakes: every question that is not fully right
 * - wrong, left empty or only partly right - against the questions the test
 * shows now. Not `questionCount - correctCount`: that is a sum of credit, so a
 * part-right multi-select question counts as a fraction of a mistake, and the
 * card said "Review 1 question" over a review that listed two.
 */
export function countMistakes(
  questions: ReadonlyArray<{ id: string; order: number; correctAnswer: string }>,
  storedAnswers: unknown
) {
  const answers = (storedAnswers ?? {}) as Record<string, unknown>;
  return questions.filter(
    (question) =>
      // Keyed by question id, or by zero-based position in older attempts.
      !normalizeStoredAnswer(answers[question.id] ?? answers[(question.order - 1).toString()], question.correctAnswer)
        .isCorrect
  ).length;
}

type OverviewInput = {
  collections: OverviewCollection[];
  /** In catalog order. */
  tests: OverviewTest[];
  /** Newest first. */
  results: OverviewResult[];
  grants: OverviewGrant[];
  now?: Date;
};

/**
 * The courses the overview shows, in order: sections the student was granted
 * (newest grant first), then sections they have practised in (most recent
 * first), two at most.
 */
function pickCourses({ collections, tests, results, grants }: OverviewInput) {
  const collectionValues = new Set(collections.map((collection) => collection.value));
  const categoryByTest = new Map(tests.map((test) => [test.id, test.category]));

  const order: string[] = [];
  const add = (category: string | null | undefined) => {
    if (category && collectionValues.has(category) && !order.includes(category)) order.push(category);
  };
  [...grants].sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime()).forEach((grant) => add(grant.category));
  for (const result of results) add(categoryByTest.get(result.testId));

  return order.slice(0, MAX_COURSES);
}

/**
 * The ids of the results the course cards call "Last", so the page can read
 * their answers (for `reviews`) before building the overview: two rows at
 * most, instead of the answers of every recent result.
 */
export function getLastResultIds(input: OverviewInput) {
  const categoryByTest = new Map(input.tests.map((test) => [test.id, test.category]));
  return pickCourses(input).flatMap((category) => {
    const last = input.results.find((result) => categoryByTest.get(result.testId) === category);
    return last ? [last.id] : [];
  });
}

function testFacts(test: OverviewTest) {
  return formatModuleBadge(test) ?? formatDuration(test.durationSeconds);
}

function isStartable(test: OverviewTest) {
  return test.canAccess && !test.isOlympiad && test.attemptsUsed === 0 && test.maxAttempts > 0;
}

export function buildPracticeOverview(
  input: OverviewInput & {
    /**
     * By result id, for the results getLastResultIds named. A result missing
     * here gets a card that opens its review unfiltered, with no count.
     */
    reviews?: ReadonlyMap<string, LastResultReview>;
  }
): PracticeOverview {
  const { collections, tests, results, grants, reviews, now = new Date() } = input;
  const collectionByValue = new Map(collections.map((collection) => [collection.value, collection]));
  const testById = new Map(tests.map((test) => [test.id, test]));
  const grantByCategory = new Map(grants.map((grant) => [grant.category, grant]));

  const courses = pickCourses(input).map((category): CourseSummary => {
    const collection = collectionByValue.get(category)!;
    const courseTests = tests.filter((test) => test.category === category);
    const courseTestIds = new Set(courseTests.map((test) => test.id));
    const courseResults = results.filter((result) => courseTestIds.has(result.testId));
    const isFullLength = (result: OverviewResult) =>
      (testById.get(result.testId)?.questionCount ?? 0) >= MIN_QUESTIONS_FOR_SCORE;

    const latestPerTest = new Map<string, OverviewResult>();
    for (const result of courseResults) if (!latestPerTest.has(result.testId)) latestPerTest.set(result.testId, result);
    const line = [...latestPerTest.values()]
      .filter(isFullLength)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-LINE_POINTS)
      .map((result) => result.score);
    const fullScores = courseResults.filter(isFullLength).map((result) => result.score);

    const last = courseResults[0];
    const lastTest = last ? testById.get(last.testId) : undefined;
    const next = courseTests.find(isStartable);
    const grant = grantByCategory.get(category);
    const review = last ? reviews?.get(last.id) : undefined;

    return {
      category,
      label: collection.label,
      description: collection.description ?? null,
      access: grant
        ? {
            // The admin chose a calendar day, stored as its last instant in
            // UTC; read in Tashkent time that is the next morning. So the day
            // is taken from UTC and counted from Tashkent's today, as the
            // admin's Students tab counts it.
            until: grant.expiresAt ? formatDate(`${utcDateKey(grant.expiresAt)}T12:00:00+05:00`) : null,
            daysLeft: grant.expiresAt
              ? Math.max(0, daysBetweenKeys(tashkentDateKey(now), utcDateKey(grant.expiresAt)))
              : null,
          }
        : null,
      testsTotal: courseTests.length,
      testsDone: courseTests.filter((test) => test.attemptsUsed > 0).length,
      nextTest: next ? { id: next.id, title: next.title, facts: testFacts(next) } : null,
      lastResult:
        last && lastTest
          ? {
              id: last.id,
              title: lastTest.title,
              score: lastTest.questionCount >= MIN_QUESTIONS_FOR_SCORE ? last.score : null,
              date: formatDate(last.createdAt),
              toReview: review?.mistakes ?? 0,
              reviewClosed: review?.closed ?? false,
            }
          : null,
      line,
      best: fullScores.length > 0 ? Math.max(...fullScores) : null,
      tests: courseTests.map((test) => ({ id: test.id, title: test.title })),
    };
  });

  // Only from a section the student can see in the catalog below, and a free
  // test before any other: the card calls it free, and a subscriber whose
  // first open test happened to be a paid one was told it was.
  let startHere: PracticeOverview['startHere'] = null;
  if (courses.length === 0) {
    const shown = tests.filter((test) => test.category !== null && collectionByValue.has(test.category) && isStartable(test));
    const first = shown.find((test) => test.isFree) ?? shown[0];
    if (first) {
      startHere = {
        id: first.id,
        title: first.title,
        facts: testFacts(first),
        isFree: first.isFree,
        hasScore: hasScoreEstimate(first.questionCount),
      };
    }
  }

  return { courses, startHere };
}

export type CollectionProgress = {
  category: string;
  label: string;
  testsDone: number;
  testsTotal: number;
  /** Best score on a full-length test of the collection; null before the first. */
  best: number | null;
};

/**
 * The profile's progress by collection: every collection the student has
 * finished a test in, most recently practised first. Counted over the tests
 * the catalog lists, so "done" never runs past "total" when a test is hidden
 * later; scores only from full-length tests, like everywhere else.
 */
export function buildCollectionProgress({
  collections,
  tests,
  results,
}: {
  collections: OverviewCollection[];
  tests: Array<{ id: string; category: string | null; questionCount: number }>;
  /** Newest first. */
  results: Array<{ testId: string; score: number }>;
}): CollectionProgress[] {
  const labelByValue = new Map(collections.map((collection) => [collection.value, collection.label]));
  const testById = new Map(tests.map((test) => [test.id, test]));

  const order: string[] = [];
  const doneByCategory = new Map<string, Set<string>>();
  const bestByCategory = new Map<string, number>();

  for (const result of results) {
    const test = testById.get(result.testId);
    if (!test?.category || !labelByValue.has(test.category)) continue;

    if (!doneByCategory.has(test.category)) {
      order.push(test.category);
      doneByCategory.set(test.category, new Set());
    }
    doneByCategory.get(test.category)!.add(test.id);

    if (test.questionCount >= MIN_QUESTIONS_FOR_SCORE) {
      bestByCategory.set(test.category, Math.max(bestByCategory.get(test.category) ?? 0, result.score));
    }
  }

  return order.map((category) => ({
    category,
    label: labelByValue.get(category)!,
    testsDone: doneByCategory.get(category)!.size,
    testsTotal: tests.filter((test) => test.category === category).length,
    best: bestByCategory.get(category) ?? null,
  }));
}
