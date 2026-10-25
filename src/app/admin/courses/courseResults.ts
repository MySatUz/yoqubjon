import { prisma } from '@/lib/prisma';
import { formatCorrectOf, hasScoreEstimate } from '@/lib/scoreDisplay';
import {
  accountForGrant,
  grantEndKey,
  isGrantActive,
  readAccountsForGrants,
  readCourseTests,
  readLatestResults,
  readToday,
} from '@/app/admin/courses/courseData';
import type { ResultsGridRow } from '@/components/admin/courses/ResultsGrid';

const DAY_MS = 86_400_000;
/** Students whose access ended this recently still belong to the group, greyed. */
const RECENTLY_ENDED_DAYS = 60;
/** "Others with results" can be everyone on a free course; past this the page says how many more. */
const MAX_OTHER_ROWS_ON_PAGE = 300;

function byName(a: { name: string | null; email: string }, b: { name: string | null; email: string }) {
  return (a.name || a.email).localeCompare(b.name || b.email);
}

/**
 * The Results tab's grid: who in the course did which visible test, and the
 * latest stored result of each. Rows are the students with access, then those
 * whose access ended in the last 60 days, then everyone else with a result
 * here (Premium students, admins). Four reads, grouped in memory. The tab and
 * its CSV (src/app/api/admin/results/sections/export) both read it, so the
 * file is the grid on screen; the file lists every other person, the page the
 * first 300 by name.
 */
export async function loadResultsGrid(courseId: string, { allOthers = false }: { allOthers?: boolean } = {}) {
  const { now, todayKey } = readToday();
  const endedSince = new Date(now.getTime() - RECENTLY_ENDED_DAYS * DAY_MS);

  const [tests, grants] = await Promise.all([
    readCourseTests(courseId),
    prisma.sectionAccess.findMany({
      where: { category: courseId },
      select: { id: true, email: true, userId: true, expiresAt: true },
    }),
  ]);
  const columns = tests
    .filter((test) => test.visible)
    .map((test) => ({ id: test.id, title: test.title, questionCount: test.questionCount }));

  const [accounts, latest] = await Promise.all([
    readAccountsForGrants(grants),
    readLatestResults(columns.map((test) => test.id)),
  ]);

  const questionCounts = new Map(columns.map((test) => [test.id, test.questionCount]));
  const cellsByUser = new Map<string, ResultsGridRow['cells']>();
  for (const result of latest) {
    const questionCount = questionCounts.get(result.testId) ?? 0;
    const cells = cellsByUser.get(result.userId) ?? {};
    cells[result.testId] = {
      // No score under 10 questions: there it is noise, so the count is shown instead.
      value: hasScoreEstimate(questionCount) ? String(result.score) : formatCorrectOf(result.correct ?? 0, questionCount),
      attempts: result.attempts,
    };
    cellsByUser.set(result.userId, cells);
  }

  const inGroup = new Set<string>();
  const groupRows: ResultsGridRow[] = [];
  for (const grant of grants) {
    const active = isGrantActive(grant, now);
    if (!active && (!grant.expiresAt || grant.expiresAt < endedSince)) continue;

    const account = accountForGrant(grant, accounts);
    if (account) inGroup.add(account.id);
    groupRows.push({
      key: grant.id,
      name: account?.name ?? null,
      email: grant.email,
      userId: account?.id ?? null,
      account: account?.account ?? 'none',
      group: active ? 'active' : 'ended',
      endedKey: active ? null : grantEndKey(grant),
      isAdmin: account?.role === 'ADMIN',
      cells: account ? cellsByUser.get(account.id) ?? {} : {},
    });
  }

  const otherIds = [...cellsByUser.keys()].filter((userId) => !inGroup.has(userId));
  const otherUsers = otherIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, email: true, name: true, role: true },
      })
    : [];
  const otherRows = otherUsers
    .sort(byName)
    .slice(0, allOthers ? undefined : MAX_OTHER_ROWS_ON_PAGE)
    .map((user): ResultsGridRow => ({
      key: user.id,
      name: user.name,
      email: user.email,
      userId: user.id,
      account: 'confirmed',
      group: 'other',
      endedKey: null,
      isAdmin: user.role === 'ADMIN',
      cells: cellsByUser.get(user.id) ?? {},
    }));

  const active = groupRows.filter((row) => row.group === 'active').sort(byName);
  const ended = groupRows.filter((row) => row.group === 'ended').sort(byName);

  return {
    todayKey,
    columns,
    hasAnyTest: tests.length > 0,
    rows: [...active, ...ended],
    otherRows,
    otherTotal: otherUsers.length,
  };
}
