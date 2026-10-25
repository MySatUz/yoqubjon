import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * There is no admin hub: the admin's places are in the sidebar, and the phone's
 * one Admin tab opens Courses. The check comes first, so a student gets the
 * 404 rather than a redirect that tells them the page exists.
 */
export default async function AdminPage() {
  await requireAdminPage();
  redirect('/admin/courses');
}
