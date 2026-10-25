import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Mirrors page.tsx: the back link, the title with its status badge, the
 * Opens / Closes / Time limit card and the status card below it. Safe now
 * that src/proxy.ts sends a guest to sign in before the page renders: the
 * page's own redirect() would otherwise run after this skeleton had streamed.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading olympiad</p>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div>
          <Skeleton className="h-7 w-72 max-w-full sm:h-8" />
          <Skeleton className="mt-2 h-5 w-24" />
        </div>
      </div>

      <div className={cardClass}>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3 sm:gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item}>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-5 w-36 max-w-full" />
            </div>
          ))}
        </div>
        {/* The "Times are Tashkent time" line. */}
        <div className="border-t border-mist-100 px-5 py-2.5">
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      <div className={cn(cardClass, 'p-5')}>
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-4/5" />
        <Skeleton className="mt-4 h-9 w-28 pointer-coarse:h-11" />
      </div>
    </Page>
  );
}
