import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { courseHref } from '@/components/admin/courses/courseLinks';

export const dynamic = 'force-dynamic';

/**
 * Tests are listed on their course's Tests tab; this old address keeps its
 * `?category=` working. A single test stays at /admin/tests/[testId].
 */
export default async function AdminTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { category } = await searchParams;
  await requireAdminPage();

  const courseId = (Array.isArray(category) ? category[0] : category)?.trim();
  redirect(courseId ? courseHref(courseId) : '/admin/courses');
}
