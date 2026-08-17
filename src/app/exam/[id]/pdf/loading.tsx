/**
 * Overrides `src/app/exam/[id]/loading.tsx` for this segment: the exam skeleton
 * is a full-height test player (fixed header, question pane, footer nav), which
 * looks nothing like the printable sheet rendered here.
 *
 * Wrapper classes are copied verbatim from `page.tsx` so the widths, paddings
 * and corner radii line up and the swap to real content costs no layout shift.
 */
function QuestionCardSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-3 w-28 animate-pulse rounded-full bg-blue-100" />
      </div>

      <div className="space-y-3">
        <div className="h-5 w-11/12 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-5 w-9/12 animate-pulse rounded-lg bg-slate-200" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((option) => (
          <div
            key={option}
            className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-slate-200" />
            <div className="mt-1 h-4 w-full animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="h-[50px] w-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-[50px] w-44 animate-pulse rounded-2xl bg-slate-200" />
        </div>

        <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <header className="border-b border-slate-200 bg-slate-900 p-8">
            <div className="mb-5 h-9 w-64 animate-pulse rounded-full bg-white/10" />
            <div className="h-10 w-3/5 animate-pulse rounded-xl bg-white/15" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-white/10" />
          </header>

          <div className="space-y-5 p-6">
            {[0, 1, 2].map((question) => (
              <QuestionCardSkeleton key={question} />
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
