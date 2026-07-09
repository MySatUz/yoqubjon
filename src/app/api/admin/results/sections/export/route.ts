import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  buildSectionLeaderboard,
  formatResultTime,
  type UserLeaderboardEntry,
} from "@/lib/resultSections";
import {
  getCategoryLabel,
  getTestCategory,
  getTestCollections,
  isTestCategory,
  normalizeCategoryId,
  type TestCategory,
} from "@/lib/testCatalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ExportRow = {
  section: string;
  rank: number;
  entry: UserLeaderboardEntry;
};

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatIsoDate(value: Date | string | null) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function formatDateForFile(value: Date) {
  return value.toISOString().slice(0, 10);
}

function categoryToFilePart(category: string | null) {
  return category ? category.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") : "all";
}

function buildCsv(rows: ExportRow[]) {
  const header = [
    "Section",
    "Rank",
    "Name",
    "Email",
    "Attempts",
    "Solved tests",
    "Total score",
    "Average score",
    "Best score",
    "Total time",
    "Latest attempt",
  ];

  const body = rows.map(({ section, rank, entry }) => [
    section,
    rank,
    entry.name || "",
    entry.email,
    entry.attempts,
    entry.uniqueTests,
    entry.totalScore,
    entry.averageScore,
    entry.bestScore,
    formatResultTime(entry.totalTimeSpent),
    formatIsoDate(entry.latestAt),
  ]);

  return [header, ...body]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const rawCategory = url.searchParams.get("category");
  const requestedCategory = rawCategory ? normalizeCategoryId(rawCategory) : null;

  if (requestedCategory && !isTestCategory(requestedCategory)) {
    return new Response("Invalid category", { status: 400 });
  }

  const [visibilityRows, results] = await Promise.all([
    prisma.testCollectionVisibility.findMany({
      select: {
        category: true,
        visible: true,
        label: true,
        description: true,
        position: true,
      },
    }),
    prisma.result.findMany({
      where: requestedCategory
        ? {
            test: {
              collectionCategory: requestedCategory,
            },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        testId: true,
        score: true,
        timeSpent: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        test: {
          select: {
            id: true,
            title: true,
            description: true,
            collectionCategory: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const collections = getTestCollections(visibilityRows);
  const groupedResults = new Map<string, typeof results>();

  for (const result of results) {
    const category = getTestCategory(result.test);
    if (requestedCategory && category !== requestedCategory) continue;

    const key = category ?? "UNASSIGNED";
    const current = groupedResults.get(key) ?? [];
    current.push(result);
    groupedResults.set(key, current);
  }

  const orderedCategories: Array<TestCategory | null> = [
    ...collections.map((collection) => collection.value),
    ...Array.from(groupedResults.keys())
      .filter((key) => key !== "UNASSIGNED" && !collections.some((collection) => collection.value === key))
      .map((key) => key as TestCategory),
    ...(groupedResults.has("UNASSIGNED") ? [null] : []),
  ];

  const rows = orderedCategories.flatMap((category) => {
    const key = category ?? "UNASSIGNED";
    const sectionResults = groupedResults.get(key) ?? [];
    if (sectionResults.length === 0) return [];

    const section = category ? getCategoryLabel(category, collections) : "Unassigned";
    return buildSectionLeaderboard(sectionResults).map((entry, index) => ({
      section,
      rank: index + 1,
      entry,
    }));
  });

  const csv = `\uFEFF${buildCsv(rows)}`;
  const filename = `mysat-section-results-${categoryToFilePart(requestedCategory)}-${formatDateForFile(new Date())}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
