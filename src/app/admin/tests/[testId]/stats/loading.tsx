/**
 * Content-only skeleton — the admin shell lives in src/app/admin/layout.tsx,
 * above this boundary. Mirrors the stats page: a pill row, the dark header, the
 * four stat tiles, then the question list.
 */
export default function Loading() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <p className="sr-only">Loading test statistics</p>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="h-12 w-40 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-12 w-52 animate-pulse rounded-2xl bg-slate-200" />
        </div>

        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>

        <div className="mt-8 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
