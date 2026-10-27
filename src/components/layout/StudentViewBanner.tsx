import { Eye } from 'lucide-react';
import { exitStudentView } from '@/app/admin/student-view-actions';
import { getShellStudentView } from '@/components/layout/shell-data';
import type { StudentViewMode } from '@/lib/studentView';
import { buttonClass } from '@/components/ui/Button';

const MODE_LABELS: Record<StudentViewMode, string> = {
  free: 'without a subscription',
  subscribed: 'with an active subscription',
};

// A slim accent bar rather than a dark banner: it has to be noticed on every
// page an admin opens in student view, without looking like page content. The
// accent is the ink-50 tint and the ink-600 icon; the text is gray, like
// every other text in the app (the old ink-800/900 at 70-80 % were in no
// family), and gray-600 for the small line, which gray-500 on ink-50 fails.
export function StudentViewBannerView({ mode }: { mode: StudentViewMode }) {
  return (
    <div className="border-b border-gray-200 bg-ink-50 px-4 py-2 text-gray-700 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-ink-600" />
          <div className="min-w-0 text-sm">
            <p>
              <span className="font-medium text-gray-900">Student view</span>
              <span> — {MODE_LABELS[mode]}</span>
            </p>
            {mode === 'subscribed' && (
              <p className="mt-0.5 text-xs text-gray-600">
                The subscription only opens tests. Profile and Subscription still show your own account.
              </p>
            )}
          </div>
        </div>
        <form action={exitStudentView}>
          <button className={buttonClass({ variant: 'secondary', size: 'sm' })}>Exit student view</button>
        </form>
      </div>
    </div>
  );
}

/**
 * Streamed island, like the admin nav entry: it renders only for an admin who
 * switched into student view, and it is their way back, because the admin
 * places in the sidebar are hidden while that view is on.
 */
export default async function StudentViewBanner() {
  const mode = await getShellStudentView();

  if (!mode) return null;

  return <StudentViewBannerView mode={mode} />;
}
