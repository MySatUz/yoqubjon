import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * The Practice home before it streams in, block by block: the PageHeader, a
 * course card, "All collections" and the collection rows. Shared by
 * loading.tsx (first paint) and the page's Suspense fallback, so the two
 * cannot drift apart. The course card is drawn because most students have
 * one: without it the collections jumped down by its height on arrival.
 */
export default function PracticeHomeSkeleton() {
  return (
    <div className="@container min-w-0 space-y-6">
      <div>
        <Skeleton className="h-7 w-32 sm:h-8" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      {/* CourseCard: title and description, then progress and the next step
          beside the score box. */}
      {/* @container, as the card is: its columns follow its own width. */}
      <div className={cn(cardClass, '@container p-5')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-5 w-32 max-sm:hidden" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 @2xl:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="min-w-0 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="mt-2 h-1.5 w-full" />
            </div>
            {/* The Start button: md, h-11 on a coarse pointer (Button.tsx). */}
            <Skeleton className="h-9 w-56 max-w-full pointer-coarse:h-11" />
          </div>
          <Skeleton className="h-30 w-full" />
        </div>
      </div>

      <div>
        <Skeleton className="mb-3 h-5 w-28" />
        <ul className={cn(cardClass, 'divide-y divide-gray-100')}>
          {[0, 1, 2].map((i) => (
            // A collection row: a 16px name line, a 12px description line,
            // the progress block on the right.
            <li key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-3 w-20 sm:w-28" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
