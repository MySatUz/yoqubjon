import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { courseHref } from '@/components/admin/courses/courseLinks';

export const dynamic = 'force-dynamic';

/**
 * Tests is now the course's own URL; this old address of the tab keeps
 * bookmarks working. The id is passed on as it came, like the sections
 * redirect; the course page 404s an unknown one.
 */
export default async function OldCourseTestsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireAdminPage();

  let id = courseId;
  try {
    id = decodeURIComponent(courseId);
  } catch {
    // Passed on undecoded; the course page 404s it.
  }
  redirect(courseHref(id));
}
