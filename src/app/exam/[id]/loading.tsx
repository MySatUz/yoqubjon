export default function Loading() {
  return (
    <main className="flex h-screen flex-col bg-slate-50">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-9 w-28 animate-pulse rounded-xl bg-blue-100" />
      </div>

      <div className="flex-1 overflow-hidden bg-white px-4 py-8 sm:px-10">
        <div className="mx-auto flex h-full max-w-4xl flex-col">
          <div className="mb-8 h-4 w-28 animate-pulse rounded-full bg-blue-100" />
          <div className="space-y-4">
            <div className="h-7 w-11/12 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-7 w-10/12 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-7 w-8/12 animate-pulse rounded-xl bg-slate-200" />
          </div>

          <div className="mt-auto grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
            <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          </div>
        </div>
      </div>

      <div className="h-20 border-t border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl justify-between">
          <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-10 w-24 animate-pulse rounded-xl bg-blue-100" />
        </div>
      </div>
    </main>
  );
}
