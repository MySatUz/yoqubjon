import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { courseHref } from '@/components/admin/courses/courseLinks';

export const dynamic = 'force-dynamic';

/**
 * A section's results page is now its course's Results tab. The id is passed
 * on as it came; the course page reads it in any case and 404s an unknown one.
 */
export default async function AdminSectionResultsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  await requireAdminPage();

  let courseId = category;
  try {
    courseId = decodeURIComponent(category);
  } catch {
    // Passed on undecoded; the course page 404s it.
  }
  redirect(courseHref(courseId, 'results'));
}
