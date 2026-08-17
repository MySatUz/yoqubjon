import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { formatResultTime, type UserLeaderboardEntry } from "@/lib/resultSections";
import { getCollectionVisibilityRows } from "@/lib/testCollections";
import {
  getCategoryLabel,
  getTestCollections,
  isTestCategory,
  normalizeCategoryId,
  type TestCategory,
} from "@/lib/testCatalog";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNASSIGNED_KEY = "UNASSIGNED";
const ROWS_PER_CHUNK = 200;
// Excel only reads the CSV as UTF-8 (Cyrillic!) when this is the very first byte.
const UTF8_BOM = String.fromCharCode(0xfeff);

const CSV_HEADER = [
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

type ExportRow = {
  section: string;
  rank: number;
  entry: UserLeaderboardEntry;
};

/**
 * One aggregated row per (section, user) straight from Postgres. Grouping the
 * whole `Result` table in Node was the reason this endpoint timed out.
 */
type LeaderboardRawRow = {
  category: string | null;
  userId: string;
  name: string | null;
  email: string;
  attempts: bigint;
  uniqueTests: bigint;
  totalScore: bigint | null;
  bestScore: number | null;
  totalTimeSpent: bigint | null;
  latestAt: Date | null;
};

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function serializeRow(cells: Array<string | number | null | undefined>) {
  return cells.map(csvCell).join(",");
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

function toTime(value: Date | string | null) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function toEntry(row: LeaderboardRawRow): UserLeaderboardEntry {
  const attempts = Number(row.attempts);
  const totalScore = Number(row.totalScore ?? 0);

  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    attempts,
    uniqueTests: Number(row.uniqueTests),
    totalScore,
    averageScore: attempts > 0 ? Math.round(totalScore / attempts) : 0,
    bestScore: row.bestScore ?? 0,
    totalTimeSpent: Number(row.totalTimeSpent ?? 0),
    latestAt: row.latestAt,
  };
}

/** Same comparator as `buildSectionLeaderboard`, kept in JS so the row order is
 *  identical to the previous implementation (SQL collations order emails differently). */
function compareEntries(a: UserLeaderboardEntry, b: UserLeaderboardEntry) {
  return (
    b.totalScore - a.totalScore ||
    b.bestScore - a.bestScore ||
    b.attempts - a.attempts ||
    toTime(b.latestAt) - toTime(a.latestAt) ||
    a.email.localeCompare(b.email)
  );
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

  const [visibilityRows, aggregated] = await Promise.all([
    getCollectionVisibilityRows(),
    // `CASE ... END` mirrors `getTestCategory` + `normalizeCategoryId`: trim,
    // upper-case, and fall back to NULL ("Unassigned") when the stored value is
    // not a valid category id.
    prisma.$queryRaw<LeaderboardRawRow[]>`
      SELECT CASE
               WHEN BTRIM(UPPER(t."collectionCategory")) ~ '^[A-Z0-9_-]{2,64}$'
                 THEN BTRIM(UPPER(t."collectionCategory"))
               ELSE NULL
             END                        AS "category",
             r."userId"                 AS "userId",
             u."name"                   AS "name",
             u."email"                  AS "email",
             COUNT(*)                   AS "attempts",
             COUNT(DISTINCT r."testId") AS "uniqueTests",
             SUM(r."score")             AS "totalScore",
             MAX(r."score")             AS "bestScore",
             SUM(r."timeSpent")         AS "totalTimeSpent",
             MAX(r."createdAt")         AS "latestAt"
        FROM "Result" r
        JOIN "Test" t ON t."id" = r."testId"
        JOIN "User" u ON u."id" = r."userId"
       WHERE (
               CAST(${requestedCategory} AS text) IS NULL
               OR t."collectionCategory" = CAST(${requestedCategory} AS text)
             )
       GROUP BY 1, r."userId", u."name", u."email"
    `,
  ]);

  const collections = getTestCollections(visibilityRows);
  const grouped = new Map<string, UserLeaderboardEntry[]>();
  const latestByKey = new Map<string, number>();

  for (const row of aggregated) {
    const key = row.category ?? UNASSIGNED_KEY;
    const entry = toEntry(row);
    const bucket = grouped.get(key);

    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(key, [entry]);
    }

    latestByKey.set(key, Math.max(latestByKey.get(key) ?? 0, toTime(entry.latestAt)));
  }

  // Section order: configured collections first (their own position order), then
  // any leftover category ids ordered by most recent attempt — which is what the
  // previous `Map` insertion order over a `createdAt desc` result list produced —
  // and finally the unassigned bucket.
  const orderedCategories: Array<TestCategory | null> = [
    ...collections.map((collection) => collection.value),
    ...Array.from(grouped.keys())
      .filter((key) => key !== UNASSIGNED_KEY && !collections.some((collection) => collection.value === key))
      .sort((a, b) => (latestByKey.get(b) ?? 0) - (latestByKey.get(a) ?? 0))
      .map((key) => key as TestCategory),
    ...(grouped.has(UNASSIGNED_KEY) ? [null] : []),
  ];

  const rows: ExportRow[] = orderedCategories.flatMap((category) => {
    const key = category ?? UNASSIGNED_KEY;
    const entries = grouped.get(key);
    if (!entries || entries.length === 0) return [];

    const section = category ? getCategoryLabel(category, collections) : "Unassigned";
    return entries
      .sort(compareEntries)
      .map((entry, index) => ({ section, rank: index + 1, entry }));
  });

  const encoder = new TextEncoder();
  let index = -1;

  // Streamed so the whole CSV never exists as one JS string. The BOM stays the
  // very first byte (Excel needs it for Cyrillic) and rows are separated by
  // "\r\n" with no trailing newline, exactly like the previous `join('\r\n')`.
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < 0) {
        controller.enqueue(encoder.encode(`${UTF8_BOM}${serializeRow(CSV_HEADER)}`));
        index = 0;
        return;
      }

      if (index >= rows.length) {
        controller.close();
        return;
      }

      const end = Math.min(index + ROWS_PER_CHUNK, rows.length);
      let chunk = "";

      for (; index < end; index += 1) {
        const { section, rank, entry } = rows[index];
        chunk += `\r\n${serializeRow([
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
        ])}`;
      }

      controller.enqueue(encoder.encode(chunk));
    },
  });

  const filename = `mysat-section-results-${categoryToFilePart(requestedCategory)}-${formatDateForFile(new Date())}.csv`;

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
