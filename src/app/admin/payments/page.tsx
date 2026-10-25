import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/** Payment requests are reviewed on the Subscription page, under its "payments" heading. */
export default async function AdminPaymentsPage() {
  await requireAdminPage();
  redirect('/dashboard/subscription#payments');
}
