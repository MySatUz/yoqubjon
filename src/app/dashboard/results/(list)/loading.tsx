import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Mirrors page.tsx: a PageHeader, the By test / All attempts switch, then one
 * card of rows. The rows are drawn as list rows at every width - the wide
 * table has the same row height, so nothing moves when it arrives.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading your results</p>
      <div>
        <Skeleton className="h-7 w-32 max-w-full sm:h-8" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-3">
        {/* segmentedClass: two h-8 items (h-9 on touch) inside a 2px track,
            so 36px, or 40px on a coarse pointer - the page must not shift
            by 4px on a phone when the real control arrives. */}
        <Skeleton className="h-9 w-52 pointer-coarse:h-10" />
        <div className={cn(cardClass, 'divide-y divide-gray-100')}>
          {Array.from({ length: 8 }, (_, i) => (
            // Same geometry as listRowClass + RowText: py-3, a 20px title line, a 16px meta line.
            <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="flex-1 space-y-1.5 py-0.5">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
