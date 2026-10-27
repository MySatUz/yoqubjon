import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { EyeOff } from 'lucide-react';
import { requireAdminPage } from '@/lib/admin';
import { getCourses, readCourseSummary, resolveCourse } from '@/app/admin/courses/courseData';
import { CourseHeaderActions, CourseTabs } from '@/components/admin/courses/CourseTabs';
import { GiveAccessHost } from '@/components/admin/courses/GiveAccess';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Feedback';
import { BackLink, Page, PageHeader } from '@/components/ui/Page';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Visible · 18 tests · 24 with access · 3 waiting for sign-up", streamed after the title. */
async function CourseMeta({ courseId, visible }: { courseId: string; visible: boolean }) {
  const summary = await readCourseSummary(courseId);

  return (
    <>
      {visible ? <Badge onCanvas>Visible</Badge> : <Badge onCanvas><EyeOff />Hidden</Badge>}
      {/* On the gray-100 canvas, where gray-500 misses AA. */}
      <span className="text-sm tabular-nums text-gray-600">
        {plural(summary.tests, 'test', 'tests')}
        {summary.hiddenTests > 0 && ` (${summary.hiddenTests} hidden)`}
        {' · '}{summary.withAccess} with access
        {summary.waiting > 0 && ` · ${summary.waiting} waiting for sign-up`}
      </span>
    </>
  );
}

/**
 * The course header and its tabs, kept across the four tabs. The course is
 * resolved here and each tab resolves it again (cached per request): a
 * layout is not re-run on every navigation, so it is not where access is
 * checked - every tab page calls `requireAdminPage()` itself.
 */
export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireAdminPage();

  const [course, courses] = await Promise.all([resolveCourse(courseId), getCourses()]);
  if (!course) notFound();

  return (
    <Page>
      {/* Holds the Give access dialog for every tab: the empty states' buttons
          that open it are gone once the first access is saved. */}
      <GiveAccessHost>
        <div className="space-y-4">
          <PageHeader
            back={<BackLink href="/admin/courses">Courses</BackLink>}
            title={course.label}
            meta={
              <Suspense fallback={<Skeleton className="h-5 w-72 max-w-full" />}>
                <CourseMeta courseId={course.value} visible={course.visible} />
              </Suspense>
            }
            actions={
              <CourseHeaderActions
                courseId={course.value}
                courses={courses.map(({ value, label, visible }) => ({ value, label, visible }))}
              />
            }
          />
          <CourseTabs courseId={course.value} />
        </div>
        {children}
      </GiveAccessHost>
    </Page>
  );
}
