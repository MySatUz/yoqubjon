/**
 * Content-only skeleton. The sidebar, mobile header and bottom bar live in
 * src/app/admin/layout.tsx, which sits above this boundary and stays mounted
 * across `/admin/**` navigations — repeating them here would draw them a second
 * time and make them flicker on every hop.
 *
 * Mirrors the wrapper every admin page uses (`px-4 py-10 sm:px-6 lg:px-8` around
 * a `mx-auto max-w-6xl` column) so the swap to real content does not shift the
 * page horizontally.
 */
export default function Loading() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <p className="sr-only">Loading admin panel</p>
      <div className="mx-auto max-w-6xl">
        {/* "Back to admin" pill: same 3rem box the real link occupies. */}
        <div className="mb-6 h-12 w-44 animate-pulse rounded-2xl bg-slate-200" />

        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
