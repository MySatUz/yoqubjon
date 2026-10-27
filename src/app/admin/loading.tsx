import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Content-only skeleton. The sidebar, mobile header and bottom bar live in
 * src/app/admin/layout.tsx, which sits above this boundary and stays mounted
 * across `/admin/**` navigations — repeating them here would draw them a second
 * time and make them flicker on every hop.
 *
 * Courses is where the admin lands, so this is its shape: the title with two
 * buttons, a card of "Needs attention" rows, and the courses table. A course
 * page has its own skeleton under its header ([courseId]/loading.tsx).
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading</p>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <Skeleton className="h-7 w-40 sm:h-8" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 pointer-coarse:h-11" />
          <Skeleton className="h-9 w-32 pointer-coarse:h-11" />
        </div>
      </div>

      <div className={cn(cardClass, 'divide-y divide-gray-100')}>
        <div className="px-5 py-4">
          <Skeleton className="h-5 w-36" />
        </div>
        {[0, 1].map((i) => (
          // Same geometry as listRowClass with an entry icon and RowText.
          <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <Skeleton className="h-9 w-9 shrink-0" />
            <div className="flex-1 space-y-1.5 py-0.5">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          </div>
        ))}
      </div>

      <div className={cn(cardClass, 'overflow-hidden')}>
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <Skeleton className="h-3 w-full max-w-xl" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 px-4 py-3">
              <Skeleton className="h-4 w-56 max-w-[40%]" />
              <Skeleton className="hidden h-4 w-16 md:block" />
              <Skeleton className="hidden h-4 w-12 md:block" />
              <Skeleton className="hidden h-4 w-12 md:block" />
              <Skeleton className="ml-auto h-4 w-40 max-w-[30%]" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
