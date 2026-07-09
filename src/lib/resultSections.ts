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

export type ResultSectionEntry = {
  id: string;
  testId: string;
  testTitle: string;
  score: number;
  timeSpent: number;
  createdAt: Date | string;
};

export type SectionResultSummary = {
  category: TestCategory | null;
  categoryKey: string;
  label: string;
  description: string;
  attempts: number;
  uniqueTests: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number;
  latestAt: Date | string | null;
  results: ResultSectionEntry[];
};

export type UserLeaderboardEntry = {
  userId: string;
  name: string | null;
  email: string;
  attempts: number;
  uniqueTests: number;
  totalScore: number;
  averageScore: number;
  bestScore: number;
  totalTimeSpent: number;
  latestAt: Date | string | null;
};

type ResultWithTest = {
  id: string;
  testId: string;
  score: number;
  timeSpent: number;
  createdAt: Date | string;
  test: ResultSectionTest;
};

type ResultWithUserAndTest = ResultWithTest & {
  user: {
    id: string;
    name: string | null;
    email: string;
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
      label: "Unassigned",
      description: "Results from tests without a section.",
      sortIndex: UNASSIGNED_SECTION_SORT_INDEX,
    };
  }

  const collectionMap = getCollectionMap(collections);
  const match = collectionMap.get(category);

  return {
    categoryKey: category,
    label: getCategoryLabel(category, collections),
    description: match?.collection.description || "Practice tests in this section.",
    sortIndex: match?.index ?? UNKNOWN_SECTION_SORT_INDEX,
  };
}

export function formatResultTime(seconds: number) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function buildSectionResultSummaries(
  results: ResultWithTest[],
  collections: TestCollectionOption[]
) {
  const grouped = new Map<string, SectionResultSummary & { sortIndex: number; testIds: Set<string> }>();

  for (const result of results) {
    const category = getTestCategory(result.test);
    const meta = getSectionMeta(category, collections);
    const current = grouped.get(meta.categoryKey) ?? {
      category,
      categoryKey: meta.categoryKey,
      label: meta.label,
      description: meta.description,
      attempts: 0,
      uniqueTests: 0,
      totalScore: 0,
      averageScore: 0,
      bestScore: 0,
      totalTimeSpent: 0,
      latestAt: null,
      results: [],
      sortIndex: meta.sortIndex,
      testIds: new Set<string>(),
    };

    current.attempts += 1;
    current.totalScore += result.score;
    current.bestScore = Math.max(current.bestScore, result.score);
    current.totalTimeSpent += result.timeSpent;
    current.latestAt = toTime(result.createdAt) > toTime(current.latestAt)
      ? result.createdAt
      : current.latestAt;
    current.testIds.add(result.testId);
    current.uniqueTests = current.testIds.size;
    current.results.push({
      id: result.id,
      testId: result.testId,
      testTitle: result.test.title,
      score: result.score,
      timeSpent: result.timeSpent,
      createdAt: result.createdAt,
    });

    grouped.set(meta.categoryKey, current);
  }

  return Array.from(grouped.values())
    .map((section) => ({
      category: section.category,
      categoryKey: section.categoryKey,
      label: section.label,
      description: section.description,
      attempts: section.attempts,
      uniqueTests: section.testIds.size,
      totalScore: section.totalScore,
      averageScore: section.attempts > 0 ? Math.round(section.totalScore / section.attempts) : 0,
      bestScore: section.bestScore,
      totalTimeSpent: section.totalTimeSpent,
      latestAt: section.latestAt,
      results: section.results.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)),
      sortIndex: section.sortIndex,
    }))
    .sort((a, b) => a.sortIndex - b.sortIndex || b.totalScore - a.totalScore || a.label.localeCompare(b.label))
    .map((section) => ({
      category: section.category,
      categoryKey: section.categoryKey,
      label: section.label,
      description: section.description,
      attempts: section.attempts,
      uniqueTests: section.uniqueTests,
      totalScore: section.totalScore,
      averageScore: section.averageScore,
      bestScore: section.bestScore,
      totalTimeSpent: section.totalTimeSpent,
      latestAt: section.latestAt,
      results: section.results,
    }));
}

export function buildSectionLeaderboard(
  results: ResultWithUserAndTest[]
) {
  const grouped = new Map<string, UserLeaderboardEntry & { testIds: Set<string> }>();

  for (const result of results) {
    const current = grouped.get(result.user.id) ?? {
      userId: result.user.id,
      name: result.user.name,
      email: result.user.email,
      attempts: 0,
      uniqueTests: 0,
      totalScore: 0,
      averageScore: 0,
      bestScore: 0,
      totalTimeSpent: 0,
      latestAt: null,
      testIds: new Set<string>(),
    };

    current.attempts += 1;
    current.totalScore += result.score;
    current.bestScore = Math.max(current.bestScore, result.score);
    current.totalTimeSpent += result.timeSpent;
    current.latestAt = toTime(result.createdAt) > toTime(current.latestAt)
      ? result.createdAt
      : current.latestAt;
    current.testIds.add(result.testId);
    current.uniqueTests = current.testIds.size;

    grouped.set(result.user.id, current);
  }

  return Array.from(grouped.values())
    .map(({ testIds, ...entry }) => ({
      ...entry,
      averageScore: entry.attempts > 0 ? Math.round(entry.totalScore / entry.attempts) : 0,
      uniqueTests: testIds.size,
    }))
    .sort((a, b) =>
      b.totalScore - a.totalScore ||
      b.bestScore - a.bestScore ||
      b.attempts - a.attempts ||
      toTime(b.latestAt) - toTime(a.latestAt) ||
      a.email.localeCompare(b.email)
    );
}
