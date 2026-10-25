'use client';

import { useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { Page } from '@/components/ui/Page';
import { Alert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

/**
 * A render error inside the dashboard keeps the shell around it, so the
 * student can retry or go elsewhere instead of facing Next's bare error page.
 * Next 16 passes `unstable_retry`, which refetches and re-renders the segment.
 */
export default function DashboardError({
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
        Check your connection and try again. Your answers and results are saved.
      </Alert>
    </Page>
  );
}
