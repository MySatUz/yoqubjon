import { Skeleton } from '@/components/ui/Feedback';
import { ModuleTransitionSkeleton } from '@/components/exam/ModuleTransition';

/**
 * Mirrors what a test opens on: the h-14 TopNav (module and title, centred
 * clock, the two tools) over the module's start screen - a new attempt waits
 * there for Start (see `ModuleTransition`), and that is how most tests open.
 * Same heights and the same card, so nothing jumps when it arrives.
 */
export default function Loading() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-gray-100">
      <p className="sr-only">Loading the test</p>

      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 sm:px-4 lg:px-6">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32 sm:w-44" />
        </div>
        <Skeleton className="h-9 w-20" />
        <div className="flex items-center gap-1">
          {/* The two tools: icons, named from `xl` (see TopNav). */}
          <Skeleton className="h-9 w-9 pointer-coarse:h-10 max-xl:pointer-coarse:w-10 xl:w-28" />
          <Skeleton className="h-9 w-9 pointer-coarse:h-10 max-xl:pointer-coarse:w-10 xl:w-32" />
        </div>
      </div>

      <ModuleTransitionSkeleton />
    </main>
  );
}
