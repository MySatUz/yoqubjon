import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Clock3, Trophy, Users } from 'lucide-react';
import { auth } from '@/auth';
import {
  canStartOlympiadAttempt,
  formatDuration,
  formatOlympiadMoment,
  getLatestStart,
  getOlympiadStatus,
  type OlympiadStatus,
} from '@/lib/olympiad';
import { getOlympiadResults, getOlympiadTest } from '@/lib/olympiadQueries';
import { formatCreditTotal } from '@/lib/resultAnswers';

const STATUS_BADGE: Record<OlympiadStatus, { label: string; className: string }> = {
  // Amber is the pending colour in this design system, which is exactly what an
  // olympiad that has not opened yet is.
  upcoming: { label: 'Upcoming', className: 'bg-amber-50 text-amber-700' },
  running: { label: 'Live now', className: 'bg-blue-50 text-blue-700' },
  finished: { label: 'Finished', className: 'bg-slate-100 text-slate-600' },
};

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
  );
}

export default async function OlympiadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const olympiad = await getOlympiadTest(id);

  // Not an olympiad at all, or a test that no longer exists: there is nothing
  // here to show, and inventing an empty page would only confuse.
  if (!olympiad) {
    notFound();
  }

  const { test, window, totalDurationSeconds } = olympiad;
  const status = getOlympiadStatus(window);
  const badge = STATUS_BADGE[status];
  const canStart = canStartOlympiadAttempt(window, totalDurationSeconds);
  const latestStart = getLatestStart(window, totalDurationSeconds);

  const results = status === 'finished' ? await getOlympiadResults(test.id, window) : null;
  const myUserId = session.user.id;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tests
        </Link>

        <div className="mb-8">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-widest ${badge.className}`}>
            <Trophy className="h-3.5 w-3.5" />
            {badge.label}
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            {test.title}
          </h1>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Opens</span>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatOlympiadMoment(window.startsAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Closes</span>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatOlympiadMoment(window.endsAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Time limit</span>
            <p className="mt-2 text-sm font-semibold tabular-nums text-slate-900">
              {formatDuration(totalDurationSeconds)}
            </p>
          </div>
        </div>

        {status === 'upcoming' && (
          <Panel>
            <h2 className="text-lg font-semibold text-slate-900">This olympiad has not started yet</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              The test opens on {formatOlympiadMoment(window.startsAt)}, Tashkent time, and stays
              open until {formatOlympiadMoment(window.endsAt)}. Start no later than{' '}
              {formatOlympiadMoment(latestStart)}, otherwise you will not be able to submit before
              it closes. The ranking appears on this page once the olympiad is over.
            </p>
          </Panel>
        )}

        {status === 'running' && (
          <Panel>
            {canStart ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">The olympiad is live</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  You get {formatDuration(totalDurationSeconds)} for the test. Start no later than{' '}
                  {formatOlympiadMoment(latestStart)} — an attempt counts only if it is submitted
                  before {formatOlympiadMoment(window.endsAt)}. Your best attempt is the one that
                  counts: most questions solved first, then the shorter time.
                </p>
                <Link
                  href={`/exam/${test.id}`}
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  Start now
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Entry is closed</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  The olympiad is still running, but a new attempt can no longer be started: it
                  needs {formatDuration(totalDurationSeconds)}, and less than that remains before
                  it closes at {formatOlympiadMoment(window.endsAt)}. The last moment to start was{' '}
                  {formatOlympiadMoment(latestStart)}. The ranking opens here once the olympiad
                  ends.
                </p>
              </>
            )}
          </Panel>
        )}

        {status === 'finished' && results && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">Results</h2>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
                <Users className="h-4 w-4" />
                <span className="tabular-nums">{results.participants}</span> participants
              </span>
            </div>

            {results.standings.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">
                Nobody took part in this olympiad.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-3">Rank</th>
                      <th className="px-6 py-3">Participant</th>
                      <th className="px-6 py-3">Solved</th>
                      <th className="px-6 py-3">Time</th>
                      <th className="px-6 py-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.standings.map((standing) => {
                      const isMe = standing.userId === myUserId;

                      return (
                        <tr
                          key={standing.userId}
                          className={`border-b border-slate-100 last:border-b-0 ${isMe ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ${
                              standing.rank === 1
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {standing.rank}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-medium ${isMe ? 'text-blue-700' : 'text-slate-900'}`}>
                              {standing.name ?? 'Participant'}
                            </span>
                            {isMe && <span className="ml-2 text-xs font-medium text-blue-600">you</span>}
                            {standing.attempts > 1 && (
                              <span className="ml-2 text-xs text-slate-400">
                                <span className="tabular-nums">{standing.attempts}</span> attempts
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-semibold tabular-nums text-slate-900">
                            {formatCreditTotal(standing.correctCount)}
                            <span className="font-normal text-slate-400"> / {results.totalQuestions}</span>
                          </td>
                          <td className="px-6 py-4 tabular-nums text-slate-600">
                            {formatDuration(standing.timeSpent)}
                          </td>
                          <td className="px-6 py-4 tabular-nums text-slate-600">{standing.score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-slate-200 px-6 py-4 text-xs font-medium text-slate-400">
              <Clock3 className="h-4 w-4" />
              The best attempt counts: most questions solved first, then the shorter time.
              Score is the estimated SAT Math score for that attempt.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
