type PageLoadingSkeletonProps = {
  title?: string;
};

export default function PageLoadingSkeleton({ title = 'Loading section' }: PageLoadingSkeletonProps) {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="h-3 w-32 animate-pulse rounded-full bg-blue-100" />
        <div className="mt-4 h-10 w-64 animate-pulse rounded-2xl bg-slate-200" />
        <p className="sr-only">{title}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-44 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            <div className="h-36 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          </div>
          <div className="h-52 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
        </div>

        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  );
}
