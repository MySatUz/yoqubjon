'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

/** Same as the dashboard's: keep the shell, offer a retry (Next 16 `unstable_retry`). */
export default function AdminError({
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
        {error.digest ? `Error reference: ${error.digest}` : 'Check your connection and try again.'}
      </Alert>
    </Page>
  );
}
