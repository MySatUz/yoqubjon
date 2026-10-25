import { Skeleton } from '@/components/ui/Feedback';
import { cardClass } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * Overrides `src/app/exam/[id]/loading.tsx` for this segment: the exam skeleton
 * is a full-height test player (fixed header, question pane, footer nav), which
 * looks nothing like the printable sheet rendered here.
 *
 * Mirrors page.tsx: a back link and the print button over one card - a header,
 * then questions divided by hairlines - so the swap costs no layout shift.
 */
function QuestionSkeleton() {
  return (
    <div className="p-5">
      <Skeleton className="mb-3 h-4 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-11/12" />
        <Skeleton className="h-5 w-9/12" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[0, 1, 2, 3].map((option) => (
          <div key={option} className="flex items-center gap-3 rounded-xl border border-mist-200 px-3 py-2.5">
            <Skeleton className="h-6 w-6 shrink-0" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-mist-100 px-4 py-6 text-mist-900 sm:px-6 lg:py-8">
      <p className="sr-only">Loading the printable test</p>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>

        <div className={cn(cardClass, 'overflow-hidden')}>
          <div className="border-b border-mist-200 p-5">
            <Skeleton className="h-7 w-3/5 sm:h-8" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>

          <div className="divide-y divide-mist-100">
            {[0, 1, 2].map((question) => (
              <QuestionSkeleton key={question} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
