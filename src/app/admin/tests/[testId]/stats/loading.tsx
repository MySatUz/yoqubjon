import { Page } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Feedback';
import { StatGroup } from '@/components/ui/Stat';
import { tableWrapClass } from '@/components/ui/List';

/** One table: a thClass header row, then `rows` rows of tdClass geometry. */
function TableSkeleton({ rows, twoLine }: { rows: number; twoLine: boolean }) {
  return (
    <div className={tableWrapClass}>
      {/* thClass row: py-2.5 around a 16px caption line. */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }, (_, i) => (
          // tdClass rows: py-3 around one line, or a name line and an email line.
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-6" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-56 max-w-full" />
              {twoLine && <Skeleton className="h-3 w-40 max-w-full" />}
            </div>
            <Skeleton className="h-4 w-28 max-sm:hidden" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Content-only skeleton — the admin shell lives in src/app/admin/layout.tsx,
 * above this boundary. Mirrors the stats page: a PageHeader with a back link
 * and one action, a StatGroup of four numbers, the questions table with its
 * order switch, then the student roster.
 */
export default function Loading() {
  return (
    <Page>
      <p className="sr-only">Loading test statistics</p>
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-7 w-72 max-w-full sm:h-8" />
            <Skeleton className="mt-2 h-4 w-56 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <StatGroup>
        {Array.from({ length: 4 }, (_, i) => (
          // Same geometry as <Stat>: a 16px label line, then a 28px (32px from sm)
          // value. Attempts and average score carry an 18px hint once anyone has
          // sat the test, and one hint sets the height of the whole row.
          <div key={i} className="bg-white px-4 py-3.5 sm:px-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-1 h-7 w-16 sm:h-8" />
            {(i === 1 || i === 2) && <Skeleton className="mt-1.5 h-3 w-24" />}
          </div>
        ))}
      </StatGroup>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-1 h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-52" />
        </div>
        <TableSkeleton rows={6} twoLine={false} />
      </div>

      <div className="space-y-3">
        <div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1 h-4 w-full max-w-xl" />
        </div>
        <TableSkeleton rows={6} twoLine />
      </div>
    </Page>
  );
}
