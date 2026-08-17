/**
 * `/exam/review/[resultId]` had no loading state at all: `exam/[id]/loading.tsx`
 * is a sibling segment, so it never applied here, and the page itself pulls the
 * whole test with every question row before rendering a byte.
 *
 * Wrapper classes mirror `page.tsx` (same `max-w-4xl`, same paddings, same
 * radii) so the skeleton and the real content occupy the same box.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Score header */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
          <div className="mb-2 h-9 w-52 animate-pulse rounded-xl bg-slate-200" />
          <div className="mb-8 h-5 w-64 animate-pulse rounded-full bg-slate-100" />

          <div className="flex items-end gap-2">
            <div className="h-14 w-32 animate-pulse rounded-2xl bg-blue-100" />
            <div className="mb-2 h-6 w-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>

        {/* Question breakdown */}
        <div className="space-y-4">
          <div className="h-7 w-56 animate-pulse rounded-xl bg-slate-200" />

          <div className="grid gap-4">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-5 w-48 animate-pulse rounded-lg bg-slate-200" />
                      <div className="h-4 w-36 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
