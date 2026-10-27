import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Mirrors page.tsx: a PageHeader with a back link; the score card - the
 * score beside its scale, four facts, the next-step row; then the review card
 * with its header and chips.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading result analysis</p>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div>
          <Skeleton className="h-7 w-72 max-w-full sm:h-8" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className={cn(cardClass, '@container')}>
        <div className="grid grid-cols-1 gap-x-10 gap-y-5 p-5 @2xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] @2xl:items-center">
          <div>
            <Skeleton className="h-4 w-36" />
            {/* text-4xl / sm:text-5xl: 40px and 48px lines. */}
            <Skeleton className="mt-1 h-10 w-40 sm:h-12" />
            <Skeleton className="mt-2 h-5 w-36" />
          </div>
          <div>
            <Skeleton className="h-2 w-full" />
            <div className="mt-1.5 flex justify-between">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
            <Skeleton className="mt-3 h-4 w-80 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 px-5 py-4 @lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            // KeyValue: a 16px label line, then a 20px value line.
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1 basis-64">
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          {/* md buttons: h-9, h-11 on a coarse pointer (Button.tsx). */}
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36 pointer-coarse:h-11" />
            <Skeleton className="h-9 w-32 pointer-coarse:h-11" />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          {/* The All / Mistakes control: 36px, 40px on a coarse pointer. */}
          <Skeleton className="h-9 w-44 pointer-coarse:h-10" />
        </div>
        <div className="space-y-4 p-5">
          <Skeleton className="h-4 w-44" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 22 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-9 pointer-coarse:h-10 pointer-coarse:w-10" />
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
