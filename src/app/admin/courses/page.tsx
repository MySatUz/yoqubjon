import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarPlus, ChevronRight, EyeOff, GraduationCap, Hourglass, Receipt, Trophy } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { formatOlympiadMoment, getOlympiadStatus, readOlympiadWindow } from '@/lib/olympiad';
import { formatDate } from '@/lib/formatDate';
import {
  getCourses,
  grantEndKey,
  isGrantActive,
  readToday,
} from '@/app/admin/courses/courseData';
import { endsSoon, formatDateKey } from '@/components/admin/courses/accessPlan';
import { courseHref } from '@/components/admin/courses/courseLinks';
import { GiveAccessButton, GiveAccessHost } from '@/components/admin/courses/GiveAccess';
import { NewCourseButton } from '@/components/admin/courses/NewCourse';
import { AttentionButton } from '@/components/admin/courses/AttentionButton';
import { linkRowClass, rowLinkClass } from '@/components/admin/adminControls';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import {
  List,
  RowText,
  listRowClass,
  listRowInteractiveClass,
  rowChevronClass,
  tableClass,
  tableWrapClass,
  tdClass,
  thClass,
} from '@/components/ui/List';
import { iconCircleClass } from '@/components/ui/Misc';
import { Page, PageHeader } from '@/components/ui/Page';
import { linkClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const metadata: Metadata = { title: 'Courses' };

const DAY_MS = 86_400_000;
/** A hidden test this new is most likely an import waiting to be checked and shown. */
const RECENT_HIDDEN_DAYS = 14;
const LISTED_HIDDEN_TESTS = 3;

const numericThClass = cn(thClass, 'text-right');
const numericTdClass = cn(tdClass, 'text-right tabular-nums');

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Everything the page shows, in one round of parallel reads: the courses,
 * their test counts, every access entry and what needs attention.
 */
async function loadCoursesOverview() {
  const { now, todayKey } = readToday();
  const recentSince = new Date(now.getTime() - RECENT_HIDDEN_DAYS * DAY_MS);

  const [courses, testGroups, grants, pendingPayments, hiddenRecent, hiddenRecentCount, olympiad] = await Promise.all([
    getCourses(),
    prisma.test.groupBy({
      by: ['collectionCategory', 'visible'],
      _count: { _all: true },
    }),
    prisma.sectionAccess.findMany({
      select: { id: true, email: true, userId: true, category: true, expiresAt: true },
    }),
    prisma.manualPaymentRequest.count({ where: { status: 'PENDING' } }),
    prisma.test.findMany({
      where: { visible: false, createdAt: { gte: recentSince } },
      orderBy: { createdAt: 'desc' },
      take: LISTED_HIDDEN_TESTS,
      select: { id: true, title: true, collectionCategory: true, createdAt: true },
    }),
    prisma.test.count({ where: { visible: false, createdAt: { gte: recentSince } } }),
    // The olympiad running now, or else the next one to open.
    prisma.test.findFirst({
      where: { olympiadStartsAt: { not: null }, olympiadEndsAt: { gt: now } },
      orderBy: { olympiadStartsAt: 'asc' },
      select: { id: true, title: true, olympiadStartsAt: true, olympiadEndsAt: true },
    }),
  ]);

  const activeGrants = grants.filter((grant) => isGrantActive(grant, now));

  const rows = courses.map((course) => {
    const courseGrants = activeGrants.filter((grant) => grant.category === course.value);
    const ending = courseGrants.filter((grant) => endsSoon(grantEndKey(grant), todayKey));
    const testCount = testGroups
      .filter((group) => group.collectionCategory === course.value)
      .reduce((total, group) => total + group._count._all, 0);
    const hiddenCount = testGroups.find((group) => group.collectionCategory === course.value && !group.visible)?._count._all ?? 0;

    return {
      course,
      testCount,
      hiddenCount,
      withAccess: courseGrants.length,
      ending,
      lastEndingKey: ending.map((grant) => grantEndKey(grant) ?? '').sort().at(-1) ?? null,
    };
  });

  const olympiadWindow = olympiad ? readOlympiadWindow(olympiad) : null;

  return {
    todayKey,
    courses,
    rows,
    pendingPayments,
    hiddenRecent,
    hiddenRecentCount,
    olympiad: olympiad && olympiadWindow
      ? { ...olympiad, window: olympiadWindow, isRunning: getOlympiadStatus(olympiadWindow, now) === 'running' }
      : null,
  };
}

export default async function AdminCoursesPage() {
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const { todayKey, courses, rows, pendingPayments, hiddenRecent, hiddenRecentCount, olympiad } = await loadCoursesOverview();
  const accessCourses = courses.map(({ value, label, visible }) => ({ value, label, visible }));
  const labelOf = (courseId: string | null) =>
    (courseId && courses.find((course) => course.value === courseId)?.label) || 'No course';
  const endingRows = rows.filter((row) => row.ending.length > 0);
  const attentionCount =
    (pendingPayments > 0 ? 1 : 0) +
    endingRows.length +
    hiddenRecent.length +
    (hiddenRecentCount > hiddenRecent.length ? 1 : 0) +
    (olympiad ? 1 : 0);

  return (
    <Page>
      {/* Holds the Give access dialog: an "Access ends" row and its Extend
          button go away once that access is extended. */}
      <GiveAccessHost>
        <PageHeader
          title="Courses"
          actions={(attentionCount > 0 || rows.length > 0) && (
            <>
              {/* Only when something waits; a bell with nothing behind it would be one more thing to check. */}
              {attentionCount > 0 && (
                <AttentionButton count={attentionCount}>
                  <ul className="divide-y divide-mist-100">
              {pendingPayments > 0 && (
                <li>
                  <Link href="/dashboard/subscription#payments" className={cn(listRowInteractiveClass, 'group')}>
                    <span className={iconCircleClass}><Receipt /></span>
                    <RowText
                      title={pendingPayments === 1 ? '1 payment waiting' : `${pendingPayments} payments waiting`}
                      meta="Reviewed on the Subscription page"
                    />
                    <ChevronRight aria-hidden className={rowChevronClass} />
                  </Link>
                </li>
              )}

              {endingRows.map((row) => (
                <li key={row.course.value} className={cn(listRowClass, 'flex-wrap sm:flex-nowrap')}>
                  <span className={iconCircleClass}><Hourglass /></span>
                  <div className="min-w-0 flex-1">
                    {/* The course is the title, so the narrow popover cuts the
                        sentence around it, never the course's name. */}
                    <Link
                      href={`${courseHref(row.course.value)}?show=ending`}
                      className={cn(linkClass, 'block truncate text-sm')}
                    >
                      {row.course.label}
                    </Link>
                    <p className="mt-0.5 text-xs text-mist-500">
                      Access ends for {plural(row.ending.length, 'student', 'students')}
                      {row.lastEndingKey && ` by ${formatDateKey(row.lastEndingKey, todayKey)}`}
                    </p>
                  </div>
                  <GiveAccessButton
                    courses={accessCourses}
                    preset={{ courseId: row.course.value, emails: row.ending.map((grant) => grant.email), months: 1 }}
                    variant="quiet"
                    size="sm"
                    label="Extend"
                    icon={<CalendarPlus className="h-4 w-4" />}
                    ariaLabel={`Extend access in ${row.course.label}`}
                    className="max-sm:w-full"
                  />
                </li>
              ))}

              {hiddenRecent.map((test) => (
                <li key={test.id}>
                  <Link href={`/admin/tests/${test.id}`} prefetch={false} className={cn(listRowInteractiveClass, 'group')}>
                    <span className={iconCircleClass}><EyeOff /></span>
                    <RowText
                      title={`Hidden test: ${test.title}`}
                      meta={`${labelOf(test.collectionCategory)} · added ${formatDate(test.createdAt)}`}
                    />
                    <ChevronRight aria-hidden className={rowChevronClass} />
                  </Link>
                </li>
              ))}
              {hiddenRecentCount > hiddenRecent.length && (
                <li className={cn(listRowClass, 'text-xs text-mist-500')}>
                  {plural(hiddenRecentCount - hiddenRecent.length, 'more hidden test', 'more hidden tests')} added in the last {RECENT_HIDDEN_DAYS} days
                </li>
              )}

              {olympiad && (
                <li>
                  <Link href={`/admin/tests/${olympiad.id}/stats`} prefetch={false} className={cn(listRowInteractiveClass, 'group')}>
                    <span className={iconCircleClass}><Trophy /></span>
                    <RowText
                      title={olympiad.isRunning ? `Open now: ${olympiad.title}` : `Next olympiad: ${olympiad.title}`}
                      meta={olympiad.isRunning
                        ? `Closes ${formatOlympiadMoment(olympiad.window.endsAt)}, Tashkent time`
                        : `${formatOlympiadMoment(olympiad.window.startsAt)} to ${formatOlympiadMoment(olympiad.window.endsAt)}, Tashkent time`}
                    />
                    <ChevronRight aria-hidden className={rowChevronClass} />
                  </Link>
                </li>
              )}
                  </ul>
                </AttentionButton>
              )}
              {rows.length > 0 && (
                <>
                  <GiveAccessButton courses={accessCourses} variant="secondary" />
                  <NewCourseButton takenIds={courses.map((course) => course.value)} />
                </>
              )}
            </>
          )}
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<GraduationCap />}
            title="No courses yet"
            description="Students are given access to a course."
            action={<NewCourseButton takenIds={[]} />}
          />
        ) : (
          <>
            {/* Desktop: a table with real columns. The whole row opens the course (see `linkRowClass`). */}
            <div className={cn(tableWrapClass, 'hidden md:block')}>
              <table className={tableClass}>
                <caption className="sr-only">Courses</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Course</th>
                    <th scope="col" className={thClass}>Visibility</th>
                    <th scope="col" className={numericThClass}>Tests</th>
                    <th scope="col" className={numericThClass}>With access</th>
                    <th scope="col" className={cn(thClass, 'w-10')}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {rows.map((row) => (
                    <tr key={row.course.value} className={cn(linkRowClass, 'group')}>
                      <td className={tdClass}>
                        <Link href={courseHref(row.course.value)} className={cn(rowLinkClass, 'block max-w-md truncate')}>
                          {row.course.label}
                        </Link>
                      </td>
                      <td className={tdClass}>
                        {row.course.visible ? <Badge>Visible</Badge> : <Badge><EyeOff />Hidden</Badge>}
                      </td>
                      <td className={cn(numericTdClass, 'whitespace-nowrap')}>
                        {row.testCount}
                        {row.hiddenCount > 0 && <span className="text-mist-500"> · {row.hiddenCount} hidden</span>}
                      </td>
                      <td className={numericTdClass}>{row.withAccess}</td>
                      <td className={tdClass}>
                        <ChevronRight aria-hidden className={rowChevronClass} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones: the same courses as rows. */}
            <List className="md:hidden">
              {rows.map((row) => (
                <li key={row.course.value}>
                  <Link href={courseHref(row.course.value)} className={cn(listRowInteractiveClass, 'group')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-mist-900">{row.course.label}</p>
                      <p className="mt-0.5 text-xs text-mist-500">
                        {row.course.visible ? 'Visible' : 'Hidden'} · {plural(row.testCount, 'test', 'tests')} · {row.withAccess} with access
                      </p>
                    </div>
                    <ChevronRight aria-hidden className={rowChevronClass} />
                  </Link>
                </li>
              ))}
            </List>
          </>
        )}
      </GiveAccessHost>
    </Page>
  );
}
