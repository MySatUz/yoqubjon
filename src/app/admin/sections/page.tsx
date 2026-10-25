import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** Sections became courses: access, visibility and names are on each course's page. */
export default async function AdminSectionsPage() {
  await requireAdminPage();
  redirect('/admin/courses');
}
