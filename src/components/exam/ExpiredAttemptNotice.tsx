"use client";

import React from 'react';
import { ArrowRight, Clock3, ListChecks, Loader2, RotateCcw } from 'lucide-react';
import { useExamStore } from '@/store/useExamStore';
import { useExamSubmit } from '@/components/exam/useExamSubmit';
import { formatDateTime } from '@/lib/formatDate';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import { cardClass } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Dialog';
import { cn } from '@/components/ui/cn';

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
  const { isSubmitting, submitExam, submitDialog } = useExamSubmit(testId);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const isLastModule = moduleIndex >= moduleCount;

  // The one way off this screen that throws work away, so it is asked once.
  const handleStartOver = async () => {
    const isSure = await confirm({
      title: 'Discard the saved answers?',
      description: `${answeredCount} ${answeredCount === 1 ? 'answer' : 'answers'} from the earlier attempt will be deleted from this browser. The new attempt starts ${moduleCount > 1 ? 'on Module 1' : 'from question 1'} with a full clock.`,
      confirmLabel: 'Discard and start again',
      cancelLabel: 'Keep them',
      tone: 'danger',
    });
    if (isSure) onStartOver();
  };

  // Printed like every other date in the app: English month, Tashkent time.
  const ranOutAt = ranOutAtMs ? formatDateTime(ranOutAtMs) : null;

  return (
    // The start screen's spacing, which is what the loading skeleton draws:
    // the card lands where the skeleton's was.
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:py-16">
      <div className={cn(cardClass, 'mx-auto w-full max-w-md p-5')}>
        <Badge>Unfinished attempt</Badge>

        <h2 className="mt-3 text-xl font-semibold tracking-tight text-gray-900">
          Time ran out while you were away
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          You started this test earlier and left before finishing it. The clock
          kept running{ranOutAt ? ` and ran out on ${ranOutAt}` : ' and has run out'}.
        </p>

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <ListChecks className="h-4 w-4 text-gray-500" />
            {answeredCount} {answeredCount === 1 ? 'answer' : 'answers'} saved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-4 w-4 text-gray-500" />
            {moduleCount > 1 ? `Stopped in Module ${moduleIndex} of ${moduleCount}` : 'No time left'}
          </span>
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleStartOver()}
            disabled={isSubmitting}
            className={buttonClass({ size: 'lg', block: true })}
          >
            <RotateCcw className="h-4 w-4" />
            Start a new attempt
          </button>
          <button
            type="button"
            onClick={isLastModule ? () => void submitExam() : onContinue}
            disabled={isSubmitting}
            className={buttonClass({ variant: 'secondary', size: 'lg', block: true })}
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

        <p className="mt-3 text-xs text-gray-500">
          A new attempt starts with a full clock and discards the saved answers.
          {isLastModule ? ' Submitting them counts as one of your attempts.' : ''}
        </p>
      </div>
      {confirmDialog}
      {submitDialog}
    </div>
  );
}
