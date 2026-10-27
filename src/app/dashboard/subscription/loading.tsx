import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Mirrors page.tsx: a PageHeader, then the plans view of SubscriptionCheckout
 * (current-plan card, two plan cards, billing history). The part below the
 * header is the same markup as the page's own CheckoutFallback.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading subscription</p>
      <div className="min-w-0">
        <Skeleton className="h-7 w-36 max-w-full sm:h-8" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
      </div>

      <div className={cardClass}>
        <div className="border-b border-gray-100 px-5 py-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-16" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className={cn(cardClass, 'p-5')}>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-4 w-44 max-w-full" />
                ))}
              </div>
              <Skeleton className="mt-5 h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className={cn(cardClass, 'divide-y divide-gray-100')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="flex-1 space-y-1.5 py-0.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-44 max-w-full" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
