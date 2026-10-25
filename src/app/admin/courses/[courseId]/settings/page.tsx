import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getCollectionVisibilityRows } from '@/lib/testCollections';
import { normalizeCategoryId, readCourseDescription } from '@/lib/testCatalog';
import { getCourses, readCourseSummary, resolveCourse } from '@/app/admin/courses/courseData';
import CourseSettingsForm from '@/components/admin/courses/CourseSettingsForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Props = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  await requireAdminPage();
  const course = await resolveCourse(courseId);
  return { title: course ? `Settings · ${course.label}` : 'Course' };
}

export default async function CourseSettingsPage({ params }: Props) {
  const { courseId } = await params;
  // Kept here on purpose: access must not depend on the segment layout.
  await requireAdminPage();

  const [course, courses, rows] = await Promise.all([resolveCourse(courseId), getCourses(), getCollectionVisibilityRows()]);
  if (!course) notFound();

  const [summary, olympiads] = await Promise.all([
    readCourseSummary(course.value),
    // A limit change reaches every test in the course; olympiads are named in the warning.
    prisma.test.findMany({
      where: { collectionCategory: course.value, olympiadStartsAt: { not: null }, olympiadEndsAt: { not: null } },
      orderBy: { olympiadStartsAt: 'asc' },
      select: { id: true, title: true, maxAttempts: true },
    }),
  ]);

  // What the admin wrote, from the stored row: not the fallback the catalog
  // shows for an empty one, nor the filler code stored for it (`readCourseDescription`).
  const stored = rows.find((row) => normalizeCategoryId(row.category) === course.value);
  const description = readCourseDescription(stored?.description);

  return (
    <CourseSettingsForm
      course={{
        value: course.value,
        label: course.label,
        description,
        visible: course.visible,
        maxAttempts: course.maxAttempts,
        hasRow: course.hasRow,
      }}
      testCount={summary.tests}
      accessEntries={summary.accessEntries}
      olympiads={olympiads}
      isLastCourse={courses.filter((option) => option.hasRow).length <= 1}
    />
  );
}
