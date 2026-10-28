import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import {
  countPeopleWithResults,
  describeResultReach,
  getCourses,
  readCourseSummary,
  readCourseTests,
  resolveCourse,
} from '@/app/admin/courses/courseData';
import CourseTests from '@/components/admin/courses/CourseTests';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  await requireAdminPage();
  const course = await resolveCourse(courseId);
  return { title: course ? `Tests · ${course.label}` : 'Course' };
}

export default async function CourseTestsPage({ params }: Props) {
  const { courseId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [course, courses] = await Promise.all([resolveCourse(courseId), getCourses()]);
  if (!course) notFound();

  const [tests, summary] = await Promise.all([readCourseTests(course.value), readCourseSummary(course.value)]);
  const reach = await countPeopleWithResults(tests.map((test) => test.id));

  return (
    <CourseTests
      course={{ value: course.value, label: course.label, maxAttempts: course.maxAttempts }}
      collections={courses}
      tests={tests.map((test) => ({ ...test, reach: describeResultReach(reach.get(test.id), summary.withAccess) }))}
    />
  );
}
