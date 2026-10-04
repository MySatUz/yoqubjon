import { Eye } from 'lucide-react';
import { exitStudentView } from '@/app/admin/student-view-actions';
import { getShellStudentView } from '@/components/layout/shell-data';
import type { StudentViewMode } from '@/lib/studentView';

const MODE_LABELS: Record<StudentViewMode, string> = {
  free: 'without a subscription',
  subscribed: 'with an active subscription',
};

export function StudentViewBannerView({ mode }: { mode: StudentViewMode }) {
  return (
    <div className="bg-slate-900 px-4 py-3 text-white sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 text-sm">
            <p>
              <span className="font-semibold">Student view</span>
              <span className="text-slate-300"> — {MODE_LABELS[mode]}</span>
            </p>
            {mode === 'subscribed' && (
              <p className="mt-0.5 text-xs text-slate-400">
                The subscription only opens tests. Profile and Subscription still show your own account.
              </p>
            )}
          </div>
        </div>
        <form action={exitStudentView}>
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-blue-50 hover:text-blue-700">
            Back to admin
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Streamed island, like the admin nav entry: it renders only for an admin who
 * switched into student view, and it is their way back, because the "Admin
 * Panel" entry is hidden while that view is on.
 */
export default async function StudentViewBanner() {
  const mode = await getShellStudentView();

  if (!mode) return null;

  return <StudentViewBannerView mode={mode} />;
}
