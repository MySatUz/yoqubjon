import {
  getCategoryLabel,
  getTestCategory,
  type TestCategory,
  type TestCollectionOption,
} from "@/lib/testCatalog";

const UNASSIGNED_SECTION_KEY = "__UNASSIGNED__";
const UNKNOWN_SECTION_SORT_INDEX = 100_000;
const UNASSIGNED_SECTION_SORT_INDEX = 100_001;

export type ResultSectionTest = {
  id: string;
  title: string;
  description?: string | null;
  collectionCategory?: string | null;
  createdAt?: Date | string;
};

type ResultWithTest = {
  id: string;
  testId: string;
  score: number;
  /** Questions solved; null on rows stored before the column existed. */
  correctCount?: number | null;
  timeSpent: number;
  createdAt: Date | string;
  test: ResultSectionTest & {
    /** Questions the test shows (its original's for a copy), when the caller read them. */
    questionCount?: number;
  };
};

function toTime(value: Date | string | null) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function getCollectionMap(collections: TestCollectionOption[]) {
  return new Map(collections.map((collection, index) => [collection.value, { collection, index }]));
}

function getSectionMeta(
  category: TestCategory | null,
  collections: TestCollectionOption[]
) {
  if (!category) {
    return {
      categoryKey: UNASSIGNED_SECTION_KEY,
      label: "No course",
      sortIndex: UNASSIGNED_SECTION_SORT_INDEX,
    };
  }

  const collectionMap = getCollectionMap(collections);
  const match = collectionMap.get(category);

  return {
    categoryKey: category,
    label: getCategoryLabel(category, collections),
    sortIndex: match?.index ?? UNKNOWN_SECTION_SORT_INDEX,
  };
}

/** One test as one student sat it, folded down from all of their attempts. */
export type TestResultSummary = {
  testId: string;
  testTitle: string;
  attempts: number;
  bestScore: number;
  /** Score of the most recent attempt, which is not always the best one. */
  latestScore: number;
  latestAt: Date | string;
  totalTimeSpent: number;
  /**
   * Questions the test shows, when the caller read them: under 10 a score is
   * noise (scoreDisplay.ts), so the counts below are shown instead.
   */
  questionCount: number | null;
  /** Most questions solved in one attempt, and in the latest; null when not stored. */
  bestCorrect: number | null;
  latestCorrect: number | null;
};

export type SectionTestSummary = {
  categoryKey: string;
  label: string;
  attempts: number;
  tests: TestResultSummary[];
};

/**
 * A student's history as one row per test, grouped by section in catalog
 * order and, inside a section, by the most recent attempt first. A list of
 * every attempt made a retaken test show up five times with nothing to say
 * which sitting was the latest; this keeps best and latest side by side.
 */
export function buildSectionTestSummaries(
  results: ResultWithTest[],
  collections: TestCollectionOption[]
): SectionTestSummary[] {
  const sections = new Map<string, {
    categoryKey: string;
    label: string;
    sortIndex: number;
    attempts: number;
    tests: Map<string, TestResultSummary>;
  }>();

  for (const result of results) {
    const meta = getSectionMeta(getTestCategory(result.test), collections);
    const section = sections.get(meta.categoryKey) ?? {
      categoryKey: meta.categoryKey,
      label: meta.label,
      sortIndex: meta.sortIndex,
      attempts: 0,
      tests: new Map<string, TestResultSummary>(),
    };
    section.attempts += 1;

    const current = section.tests.get(result.testId);
    const correct = result.correctCount ?? null;
    if (!current) {
      section.tests.set(result.testId, {
        testId: result.testId,
        testTitle: result.test.title,
        attempts: 1,
        bestScore: result.score,
        latestScore: result.score,
        latestAt: result.createdAt,
        totalTimeSpent: result.timeSpent,
        questionCount: result.test.questionCount ?? null,
        bestCorrect: correct,
        latestCorrect: correct,
      });
    } else {
      current.attempts += 1;
      current.bestScore = Math.max(current.bestScore, result.score);
      if (correct !== null) current.bestCorrect = Math.max(current.bestCorrect ?? 0, correct);
      current.totalTimeSpent += result.timeSpent;
      if (toTime(result.createdAt) > toTime(current.latestAt)) {
        current.latestAt = result.createdAt;
        current.latestScore = result.score;
        current.latestCorrect = correct;
      }
    }

    sections.set(meta.categoryKey, section);
  }

  return Array.from(sections.values())
    .sort((a, b) => a.sortIndex - b.sortIndex || a.label.localeCompare(b.label))
    .map((section) => ({
      categoryKey: section.categoryKey,
      label: section.label,
      attempts: section.attempts,
      tests: Array.from(section.tests.values())
        .sort((a, b) => toTime(b.latestAt) - toTime(a.latestAt)),
    }));
}
