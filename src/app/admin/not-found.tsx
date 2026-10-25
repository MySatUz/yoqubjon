import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonClass } from '@/components/ui/Button';

/** Inside the admin layout, so the shell stays and the way back is one click. */
export default function AdminNotFound() {
  return (
    <Page>
      <EmptyState
        icon={<SearchX />}
        title="This page isn't available"
        description="The course, test or user may have been deleted."
        action={
          <Link href="/admin/courses" className={buttonClass()}>
            Go to courses
          </Link>
        }
      />
    </Page>
  );
}
