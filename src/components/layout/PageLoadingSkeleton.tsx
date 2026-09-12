/**
 * Route-level loading skeletons for the dashboard segments.
 *
 * Each variant mirrors the grid and the block heights of the page it stands in
 * for, so the swap from skeleton to content does not move anything. Adding a new
 * dashboard segment means adding a variant here, not reusing a neighbour's.
 */
type SkeletonVariant = 'practice' | 'profile' | 'subscription' | 'result';

type PageLoadingSkeletonProps = {
  title?: string;
  variant?: SkeletonVariant;
};

const block = 'animate-pulse border border-slate-200 bg-white';

export default function PageLoadingSkeleton({
  title = 'Loading section',
  variant = 'practice',
}: PageLoadingSkeletonProps) {
  return (
    <>
      <p className="sr-only">{title}</p>
      {variant === 'practice' && <PracticeSkeleton />}
      {variant === 'profile' && <ProfileSkeleton />}
      {variant === 'subscription' && <SubscriptionSkeleton />}
      {variant === 'result' && <ResultSkeleton />}
    </>
  );
}

/** Mirrors /dashboard: `lg:grid-cols-4`, catalog on `lg:col-span-3`. */
function PracticeSkeleton() {
  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          <header className="mb-10">
            <div className="h-10 w-72 max-w-full animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-3 h-6 w-[26rem] max-w-full animate-pulse rounded-full bg-slate-100" />
          </header>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-80 rounded-2xl ${block}`} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="mb-6 h-7 w-44 animate-pulse rounded-full bg-slate-200" />
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-28 rounded-2xl ${block}`} />
            ))}
          </div>
          <div className="mt-8 h-40 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors /dashboard/profile: `xl:grid-cols-[1.05fr_0.95fr]` + two full-width rows. */
function ProfileSkeleton() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-3 w-36 animate-pulse rounded-full bg-blue-100" />
          <div className="mt-3 h-10 w-72 max-w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-3 h-5 w-[28rem] max-w-full animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-12 w-44 animate-pulse rounded-2xl bg-slate-200" />
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className={`h-80 rounded-2xl ${block}`} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-40 rounded-2xl ${block}`} />
          ))}
        </div>

        <div className={`h-72 rounded-2xl xl:col-span-2 ${block}`} />
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200 xl:col-span-2" />
      </div>
    </div>
  );
}

/** Mirrors /dashboard/subscription: centred `max-w-6xl` banner + split panels. */
function SubscriptionSkeleton() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className={`mx-auto mb-10 h-56 max-w-6xl rounded-2xl ${block}`} />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`h-80 rounded-2xl ${block}`} />
          <div className={`h-80 rounded-2xl ${block}`} />
        </div>
        <div className={`h-64 rounded-2xl ${block}`} />
      </div>
    </div>
  );
}

/** Mirrors /dashboard/results/[id]: full-bleed dark header, stat row pulled up by -mt-12. */
function ResultSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="bg-slate-900 pt-12 pb-24">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-8 h-5 w-44 animate-pulse rounded-full bg-white/10" />
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <div className="h-10 w-80 max-w-full animate-pulse rounded-2xl bg-white/10" />
              <div className="mt-3 h-6 w-56 max-w-full animate-pulse rounded-full bg-white/10" />
            </div>
            <div className="h-28 w-72 max-w-full animate-pulse rounded-2xl bg-white/10" />
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-12 max-w-5xl px-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-28 rounded-xl ${block}`} />
          ))}
        </div>

        <div className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div className="h-8 w-56 animate-pulse rounded-full bg-slate-200" />
            <div className="h-9 w-60 max-w-full animate-pulse rounded-full bg-slate-200" />
          </div>
          {/* The review is a grid of question chips, one 2.75rem square each. */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className={`mt-6 h-16 rounded-2xl ${block}`} />
        </div>
      </div>
    </div>
  );
}
