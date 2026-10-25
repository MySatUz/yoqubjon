'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

/**
 * Below the olympiad layout, so a render error keeps the shell around it, as
 * in the dashboard (dashboard/error.tsx); without this file the root error
 * page would replace the shell too. `unstable_retry` refetches and re-renders
 * the segment.
 */
export default function OlympiadError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page>
      <Alert
        tone="danger"
        title="This page didn't load"
        action={
          <Button variant="secondary" size="sm" onClick={() => unstable_retry()}>
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
        }
      >
        {/* No "your answers are saved", unlike the dashboard: this page takes
            no answers, so it would promise nothing. */}
        Check your connection and try again.
      </Alert>
    </Page>
  );
}
