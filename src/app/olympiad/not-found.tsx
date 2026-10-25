import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonClass } from '@/components/ui/Button';

/**
 * Inside the olympiad layout, so the sidebar and the tab bar stay. Olympiad
 * links travel in Telegram long after the test is edited or removed; an old
 * one should lead back to Practice, not out of the app.
 */
export default function OlympiadNotFound() {
  return (
    <Page>
      <EmptyState
        icon={<Trophy />}
        title="This olympiad isn't here"
        description="The link may be old, or the olympiad was removed."
        action={
          <Link href="/dashboard" className={buttonClass()}>
            Go to Practice
          </Link>
        }
      />
    </Page>
  );
}
