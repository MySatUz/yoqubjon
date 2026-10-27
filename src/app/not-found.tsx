import Link from 'next/link';
import { SearchX } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import { EmptyState } from '@/components/ui/Feedback';
import { buttonClass, focusRingClass } from '@/components/ui/Button';

/**
 * Unmatched URLs and the pages outside the app shell (exam, payment); the
 * dashboard, admin and olympiad keep their shell with their own not-found.
 * Same canvas and empty state as inside the app, with the mark on top so the
 * page still says whose site this is, and one way on, as every empty state
 * has. The mark above already links home.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-12">
      <Link href="/" className={`mb-6 flex items-center gap-2.5 rounded-lg ${focusRingClass}`} aria-label="MYSATuz home">
        <BrandMark size="sm" />
        <span className="text-base font-semibold tracking-tight text-gray-900">MYSATuz</span>
      </Link>
      <EmptyState
        className="w-full max-w-md"
        icon={<SearchX />}
        title="This page isn't here"
        description="The link may be old or mistyped."
        action={
          <Link href="/dashboard" className={buttonClass()}>
            Go to Practice
          </Link>
        }
      />
    </main>
  );
}
