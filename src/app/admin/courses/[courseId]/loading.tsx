import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * A tab loading under the course header, which the layout keeps on screen:
 * a toolbar line and a card of rows, the shape all four tabs share.
 */
export default function Loading() {
  return (
    <div className="space-y-4">
      <p className="sr-only">Loading</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-24 pointer-coarse:h-10" />
          ))}
        </div>
        <Skeleton className="h-9 w-32 pointer-coarse:h-11" />
      </div>
      <div className={cn(cardClass, 'divide-y divide-gray-100')}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <div className="flex-1 space-y-1.5 py-0.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-28 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
