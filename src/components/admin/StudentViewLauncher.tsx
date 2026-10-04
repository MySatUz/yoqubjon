import { Eye } from 'lucide-react';
import { enterStudentView } from '@/app/admin/student-view-actions';

/**
 * Two plain forms instead of a client component: each button posts its mode to
 * the action, which sets the cookie and lands on the Practice Center.
 */
export default function StudentViewLauncher() {
  return (
    <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Eye className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">See the site as a student</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Opens the Practice Center exactly as a student sees it: hidden tests and sections stay
            hidden, and attempt limits, olympiad windows and start codes all apply. Your admin
            tools come back with one click.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={enterStudentView}>
          <input type="hidden" name="mode" value="free" />
          <button className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600">
            Without subscription
          </button>
        </form>
        <form action={enterStudentView}>
          <input type="hidden" name="mode" value="subscribed" />
          <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
            With subscription
          </button>
        </form>
      </div>
    </section>
  );
}
