import { cache } from 'react';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeAccessEmail } from '@/lib/sectionAccess';
import {
  findCategoryByQuery,
  getTestCollections,
  normalizeCategoryId,
  sortCatalogTests,
  type TestCollectionOption,
} from '@/lib/testCatalog';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import {
  tashkentDateKey,
  utcDateKey,
  type AccessAccountState,
} from '@/components/admin/courses/accessPlan';

/*
 * Server reads for the admin's course pages. Plain functions, not actions:
 * the pages call them after `requireAdminPage()`. Every read selects its
 * columns and lists are grouped in memory, never one query per row.
 */

export type Course = TestCollectionOption & {
  /** False for a built-in course shown while the table is empty (`getTestCollections`). */
  hasRow: boolean;
};

/** Every course in position order, the built-in ones included while the table is empty. */
export const getCourses = cache(async (): Promise<Course[]> => {
  const rows = await getCollectionVisibilityRows();
  const stored = new Set(rows.map((row) => normalizeCategoryId(row.category)));
  return getTestCollections(rows).map((course) => ({ ...course, hasRow: stored.has(course.value) }));
});

/**
 * The course a URL names: its id as stored, in any case, or the dashed form
 * students' links use (`sat-evening-chilonzor`). Null for anything else.
 */
export const resolveCourse = cache(async (param: string): Promise<Course | null> => {
  let raw = param;
  try {
    raw = decodeURIComponent(param);
  } catch {
    // A stray % is just part of an id that does not exist.
  }

  const courses = await getCourses();
  const id = normalizeCategoryId(raw);
  const match = courses.find((course) => course.value === id)
    ?? courses.find((course) => course.value === findCategoryByQuery(courses, raw));
  return match ?? null;
});

export type StoredGrant = {
  id: string;
  email: string;
  userId: string | null;
  expiresAt: Date | null;
  note: string | null;
};

export type Account = {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  account: AccessAccountState;
};

/**
 * Accounts for a set of access entries, keyed by email - access is given by
 * email, often before the student signs up - with an entry's own `userId` as
 * a second way in.
 */
export async function readAccountsForGrants(grants: Array<{ email: string; userId: string | null }>) {
  const emails = [...new Set(grants.map((grant) => grant.email))];
  const userIds = [...new Set(grants.map((grant) => grant.userId).filter((id): id is string => Boolean(id)))];
  if (emails.length === 0) return { byEmail: new Map<string, Account>(), byId: new Map<string, Account>() };

  const users = await prisma.user.findMany({
    where: { OR: [{ email: { in: emails } }, ...(userIds.length > 0 ? [{ id: { in: userIds } }] : [])] },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      pendingEmailVerification: { select: { userId: true } },
    },
  });

  const accounts = users.map((user): Account => ({
    id: user.id,
    email: normalizeAccessEmail(user.email),
    name: user.name,
    role: user.role,
    account: user.pendingEmailVerification ? 'waiting' : 'confirmed',
  }));

  return {
    byEmail: new Map(accounts.map((account) => [account.email, account])),
    byId: new Map(accounts.map((account) => [account.id, account])),
  };
}

export function accountForGrant(
  grant: { email: string; userId: string | null },
  accounts: { byEmail: Map<string, Account>; byId: Map<string, Account> },
) {
  return accounts.byEmail.get(grant.email) ?? (grant.userId ? accounts.byId.get(grant.userId) : undefined);
}

export function isGrantActive(grant: { expiresAt: Date | null }, now: Date) {
  return grant.expiresAt === null || grant.expiresAt > now;
}

export function grantEndKey(grant: { expiresAt: Date | null }) {
  return grant.expiresAt ? utcDateKey(grant.expiresAt) : null;
}

export function readToday() {
  const now = new Date();
  return { now, todayKey: tashkentDateKey(now) };
}

/** The numbers in a course's header: its tests, who has access and who has still to sign up. */
export const readCourseSummary = cache(async (courseId: string) => {
  const { now } = readToday();
  const [testGroups, grants] = await Promise.all([
    prisma.test.groupBy({
      by: ['visible'],
      where: { collectionCategory: courseId },
      _count: { _all: true },
    }),
    prisma.sectionAccess.findMany({
      where: { category: courseId },
      select: { email: true, userId: true, expiresAt: true },
    }),
  ]);

  const active = grants.filter((grant) => isGrantActive(grant, now));
  const accounts = await readAccountsForGrants(active);

  return {
    tests: testGroups.reduce((total, group) => total + group._count._all, 0),
    hiddenTests: testGroups.find((group) => !group.visible)?._count._all ?? 0,
    accessEntries: grants.length,
    withAccess: active.length,
    waiting: active.filter((grant) => accountForGrant(grant, accounts)?.account !== 'confirmed').length,
  };
});

/**
 * Per test: how many people have a result, and how many of them hold live
 * access to the test's course - the "18 of 24 have a result" of the course
 * pages. `COUNT(DISTINCT ...)` is why this is SQL; access matches by account
 * or by email, as everywhere else.
 */
export async function countPeopleWithResults(testIds: string[]) {
  if (testIds.length === 0) return new Map<string, { people: number; withAccess: number }>();

  const rows = await prisma.$queryRaw<Array<{ testId: string; people: number; withAccess: number }>>`
    SELECT r."testId"                                                     AS "testId",
           COUNT(DISTINCT r."userId")::int                                AS "people",
           COUNT(DISTINCT r."userId") FILTER (WHERE a."id" IS NOT NULL)::int AS "withAccess"
      FROM "Result" r
      JOIN "Test" t ON t."id" = r."testId"
      JOIN "User" u ON u."id" = r."userId"
      LEFT JOIN "SectionAccess" a
        ON a."category" = t."collectionCategory"
       AND (a."userId" = r."userId" OR a."email" = LOWER(u."email"))
       -- The column holds UTC without a zone (Prisma's TIMESTAMP(3)): compare with UTC now.
       AND (a."expiresAt" IS NULL OR a."expiresAt" > (NOW() AT TIME ZONE 'UTC'))
     WHERE r."testId" IN (${Prisma.join(testIds)})
     GROUP BY r."testId"
  `;

  return new Map(rows.map((row) => [row.testId, { people: row.people, withAccess: row.withAccess }]));
}

/** "18 of 24 have a result"; with nobody given access, the people who have one. */
export function describeResultReach(counts: { people: number; withAccess: number } | undefined, withAccess: number) {
  const people = counts?.people ?? 0;
  if (withAccess > 0) return `${counts?.withAccess ?? 0} of ${withAccess} have a result`;
  if (people === 0) return 'No result yet';
  return people === 1 ? '1 person has a result' : `${people} people have a result`;
}

const courseTestSelect = {
  id: true,
  title: true,
  description: true,
  collectionCategory: true,
  createdAt: true,
  durationSeconds: true,
  moduleDurations: true,
  maxAttempts: true,
  olympiadStartsAt: true,
  olympiadEndsAt: true,
  accessCode: true,
  isFree: true,
  visible: true,
  questionSourceId: true,
  // A copy has no questions of its own; its count and its name come from the original.
  questionSource: {
    select: {
      title: true,
      collectionCategory: true,
      _count: { select: { questions: true } },
    },
  },
  _count: { select: { questions: true, questionCopies: true } },
} satisfies Prisma.TestSelect;

/** The course's tests in the order students see them, each with the number of questions it shows. */
export async function readCourseTests(courseId: string) {
  const tests = await prisma.test.findMany({
    where: { collectionCategory: courseId },
    orderBy: { createdAt: 'desc' },
    select: courseTestSelect,
  });

  return sortCatalogTests(tests).map((test) => ({
    ...test,
    questionCount: test.questionSource?._count.questions ?? test._count.questions,
  }));
}

export type CourseTest = Awaited<ReturnType<typeof readCourseTests>>[number];

/**
 * The latest stored result of each person on each of these tests, with how
 * many attempts they made. `DISTINCT ON` keeps the newest row whole; the
 * window count runs before it. `correctCount` is NULL on rows written before
 * the column was filled in, so it is recomputed from the stored answers the
 * way `fetchTestRoster` (src/lib/testStats.ts) does.
 */
export async function readLatestResults(testIds: string[]) {
  if (testIds.length === 0) return [];

  return prisma.$queryRaw<Array<{
    id: string;
    userId: string;
    testId: string;
    score: number;
    correct: number | null;
    createdAt: Date;
    attempts: number;
  }>>`
    SELECT DISTINCT ON (r."userId", r."testId")
           r."id"        AS "id",
           r."userId"    AS "userId",
           r."testId"    AS "testId",
           r."score"     AS "score",
           r."createdAt" AS "createdAt",
           COUNT(*) OVER (PARTITION BY r."userId", r."testId")::int AS "attempts",
           COALESCE(
             r."correctCount",
             (
               SELECT COALESCE(SUM(
                 COALESCE(
                   NULLIF(answer.value ->> 'credit', '')::double precision,
                   CASE WHEN (answer.value ->> 'isCorrect')::boolean THEN 1 ELSE 0 END
                 )
               ), 0)
                 FROM jsonb_each(
                   CASE
                     WHEN jsonb_typeof(r."answers"::jsonb) = 'object' THEN r."answers"::jsonb
                     ELSE '{}'::jsonb
                   END
                 ) AS answer
                WHERE jsonb_typeof(answer.value) = 'object'
             )
           )::double precision AS "correct"
      FROM "Result" r
     WHERE r."testId" IN (${Prisma.join(testIds)})
     ORDER BY r."userId", r."testId", r."createdAt" DESC
  `;
}
