import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { StatGroup } from '@/components/ui/Stat';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Mirrors page.tsx: a PageHeader, the one-row account card, a StatGroup of
 * five numbers, then progress by collection beside the name card. The
 * in-page Suspense fallbacks draw the same shapes.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading your profile</p>
      <div>
        <Skeleton className="h-7 w-32 max-w-full sm:h-8" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className={cn(cardClass, 'flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center')}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-gray-200/70" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-40 pointer-coarse:h-10" />
      </div>

      <StatGroup>
        {Array.from({ length: 5 }, (_, i) => (
          // Same geometry as <Stat> with a hint: a 16px label line, a 28px
          // (32px from sm) value, a 16px hint line.
          <div key={i} className="bg-white px-4 py-3.5 sm:px-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1 h-7 w-16 sm:h-8" />
            <Skeleton className="mt-0.5 h-4 w-28 max-w-full" />
          </div>
        ))}
      </StatGroup>

      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className={cardClass}>
            <div className="space-y-1.5 border-b border-gray-100 px-5 py-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="divide-y divide-gray-100">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                  <Skeleton className="h-8 w-12" />
                </div>
              ))}
            </div>
          </div>
          <div className={cardClass}>
            <div className="space-y-1.5 border-b border-gray-100 px-5 py-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-9 w-full max-w-sm pointer-coarse:h-11" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-9 w-28 pointer-coarse:h-11" />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
