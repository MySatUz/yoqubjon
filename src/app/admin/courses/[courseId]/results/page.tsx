import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { getCourses, resolveCourse } from '@/app/admin/courses/courseData';
import { loadResultsGrid } from '@/app/admin/courses/courseResults';
import ResultsGrid from '@/components/admin/courses/ResultsGrid';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  await requireAdminPage();
  const course = await resolveCourse(courseId);
  return { title: course ? `Results · ${course.label}` : 'Course' };
}

export default async function CourseResultsPage({ params }: Props) {
  const { courseId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [course, courses] = await Promise.all([resolveCourse(courseId), getCourses()]);
  if (!course) notFound();

  const grid = await loadResultsGrid(course.value);

  return (
    <ResultsGrid
      courseId={course.value}
      courses={courses.map(({ value, label, visible }) => ({ value, label, visible }))}
      {...grid}
    />
  );
}
