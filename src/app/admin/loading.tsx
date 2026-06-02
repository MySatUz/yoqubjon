import PageLoadingSkeleton from '@/components/layout/PageLoadingSkeleton';
import { GraduationCap } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden h-screen w-72 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 shadow-lg shadow-slate-200">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">MYSATuz</span>
          </div>
        </div>
        <div className="space-y-2 px-4">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-xl bg-blue-50" />
        </div>
      </aside>

      <main className="flex-1">
        <PageLoadingSkeleton title="Loading admin panel" />
      </main>
    </div>
  );
}
