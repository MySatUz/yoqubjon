import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonClass } from '@/components/ui/Button';

/**
 * Inside the dashboard layout, so the sidebar and the tab bar stay: a result
 * that was deleted, or belongs to another account, is a dead link, not the end
 * of the session. The query filters by user, so "not yours" and "gone" look the
 * same here on purpose. One way on, as every empty state has: a dead link
 * here is almost always an old result, so it leads back to Results.
 */
export default function DashboardNotFound() {
  return (
    <Page>
      <EmptyState
        icon={<SearchX />}
        title="This page isn't available"
        description="The link may be old, or it belongs to another account."
        action={
          <Link href="/dashboard/results" className={buttonClass()}>
            Go to Results
          </Link>
        }
      />
    </Page>
  );
}
