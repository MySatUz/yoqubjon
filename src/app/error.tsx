'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import { Alert } from '@/components/ui/Feedback';
import { Button, buttonClass, focusRingClass } from '@/components/ui/Button';

/**
 * A render error on a page outside the app shell — the exam, payment, the
 * sign-in pages, the landing (dashboard, admin and olympiad keep their shell
 * with their own error.tsx). On the canvas with the mark on top as the root
 * not-found page draws it, so a crash still says whose site this is and
 * offers a way on instead of Next's bare error page.
 *
 * Only the exam says the work is safe: its answers are kept in this browser
 * as they are given (useExamStore) and its results on the server. On a
 * payment or sign-in page that promise would be about nothing, or wrong.
 *
 * It sits inside the root layout, so the font and globals are there; only an
 * error in the root layout itself would need a global-error.tsx.
 */
export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname();
  const inExam = pathname?.startsWith('/exam/') ?? false;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-12">
      <Link href="/" className={`mb-6 flex items-center gap-2.5 rounded-lg ${focusRingClass}`} aria-label="MYSATuz home">
        <BrandMark size="sm" />
        <span className="text-base font-semibold tracking-tight text-gray-900">MYSATuz</span>
      </Link>
      <div className="w-full max-w-md space-y-4">
        <Alert tone="danger" title="This page didn't load">
          {inExam
            ? 'Check your connection and try again. Your answers and results are saved.'
            : 'Check your connection and try again.'}
        </Alert>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => unstable_retry()}>
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/" className={buttonClass({ variant: 'secondary' })}>
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
