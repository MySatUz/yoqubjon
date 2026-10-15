"use client";

import React from 'react';
import { ArrowRight, Clock3, ListChecks, Loader2, RotateCcw } from 'lucide-react';
import { useExamStore } from '@/store/useExamStore';
import { useExamSubmit } from '@/components/exam/useExamSubmit';

interface ExpiredAttemptNoticeProps {
  testId: string;
  moduleIndex: number;
  moduleCount: number;
  onStartOver: () => void;
  /** Hands over to the next module; only offered before the last one. */
  onContinue: () => void;
}

/**
 * Shown instead of the questions when a saved attempt is opened after its
 * clock already ran out while the test was closed - see `ranOutWhileAway` in
 * the exam store.
 *
 * It used to be submitted, or handed over to the next module, the moment the
 * test opened, which students read as "I started the test and it finished by
 * itself". An attempt with no answers never gets here: it is replaced by a new
 * one without asking.
 */
export default function ExpiredAttemptNotice({
  testId,
  moduleIndex,
  moduleCount,
  onStartOver,
  onContinue,
}: ExpiredAttemptNoticeProps) {
  // Selected as plain values, so a tick elsewhere in the store does not
  // re-render this screen.
  const answeredCount = useExamStore((state) =>
    Object.values(state.answers).filter((answer) => answer.trim() !== '').length
  );
  const ranOutAtMs = useExamStore((state) => state.endsAtMs);
  // Sent from here rather than by clearing the flag and letting the header's
  // clock end the module: this screen stays up while the result is on its
  // way, and after a failed send, instead of reopening the questions a day
  // after the time ran out.
  const { isSubmitting, submitExam } = useExamSubmit(testId);

  const isLastModule = moduleIndex >= moduleCount;
  // The interface is in English, so the month is too; the time stays the
  // student's own.
  const ranOutAt = ranOutAtMs
    ? new Date(ranOutAtMs).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : null;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-600">
          Unfinished attempt
        </span>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Time ran out while you were away
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          You started this test earlier and left before finishing it. The clock
          kept running{ranOutAt ? ` and ran out on ${ranOutAt}` : ' and has run out'}.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <ListChecks className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {answeredCount} {answeredCount === 1 ? 'answer' : 'answers'} saved
            </span>
          </div>
          <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <Clock3 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-slate-900">
              {moduleCount > 1 ? `Stopped in Module ${moduleIndex} of ${moduleCount}` : 'No time left'}
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onStartOver}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <RotateCcw className="h-5 w-5" />
            Start a new attempt
          </button>
          <button
            type="button"
            onClick={isLastModule ? () => void submitExam() : onContinue}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              <>
                {isLastModule ? 'Submit the saved answers' : `Go on to Module ${moduleIndex + 1}`}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          A new attempt starts with a full clock and discards the saved answers.
          {isLastModule ? ' Submitting them counts as one of your attempts.' : ''}
        </p>
      </div>
    </div>
  );
}
