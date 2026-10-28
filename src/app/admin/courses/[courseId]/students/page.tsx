import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import {
  accountForGrant,
  getCourses,
  grantEndKey,
  isGrantActive,
  readAccountsForGrants,
  readToday,
  resolveCourse,
} from '@/app/admin/courses/courseData';
import { tashkentDateKey } from '@/components/admin/courses/accessPlan';
import StudentsTable, { type StudentFilter, type StudentRow } from '@/components/admin/courses/StudentsTable';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ show?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  await requireAdminPage();
  const course = await resolveCourse(courseId);
  return { title: course ? `Students · ${course.label}` : 'Course' };
}

const FILTERS: StudentFilter[] = ['all', 'active', 'ending', 'ended', 'waiting'];

/**
 * Every access entry of the course, ended ones included, with the account
 * behind each email and the date of its latest result here. Three reads: the
 * entries, their accounts, and one grouped read of the latest results.
 */
async function loadStudents(courseId: string) {
  const { now, todayKey } = readToday();
  const grants = await prisma.sectionAccess.findMany({
    where: { category: courseId },
    select: { id: true, email: true, userId: true, expiresAt: true, note: true },
  });
  const accounts = await readAccountsForGrants(grants);
  const userIds = [...accounts.byId.keys()];
  const latest = userIds.length > 0
    ? await prisma.result.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, test: { collectionCategory: courseId } },
        _max: { createdAt: true },
      })
    : [];
  const latestByUser = new Map(latest.map((row) => [row.userId, row._max.createdAt]));

  const rows = grants.map((grant): StudentRow => {
    const account = accountForGrant(grant, accounts);
    const lastResultAt = account ? latestByUser.get(account.id) : null;
    return {
      id: grant.id,
      email: grant.email,
      name: account?.name ?? null,
      userId: account?.id ?? null,
      account: account?.account ?? 'none',
      endKey: grantEndKey(grant),
      active: isGrantActive(grant, now),
      note: grant.note,
      lastResultKey: lastResultAt ? tashkentDateKey(lastResultAt) : null,
    };
  });

  rows.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  return { todayKey, rows };
}

export default async function CourseStudentsPage({ params, searchParams }: Props) {
  const [{ courseId }, { show }] = await Promise.all([params, searchParams]);
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [course, courses] = await Promise.all([resolveCourse(courseId), getCourses()]);
  if (!course) notFound();

  const { todayKey, rows } = await loadStudents(course.value);
  const requested = Array.isArray(show) ? show[0] : show;
  const initialFilter = FILTERS.find((filter) => filter === requested) ?? 'all';

  return (
    <StudentsTable
      courseId={course.value}
      courseLabel={course.label}
      courses={courses.map(({ value, label, visible }) => ({ value, label, visible }))}
      rows={rows}
      todayKey={todayKey}
      initialFilter={initialFilter}
    />
  );
}
