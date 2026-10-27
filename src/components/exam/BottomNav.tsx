"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2 } from 'lucide-react';
import { useExamStore } from '@/store/useExamStore';
import { flushPendingAnswer } from '@/components/exam/pendingAnswer';
import { useExamSubmit } from '@/components/exam/useExamSubmit';
import QuestionNavigator from '@/components/exam/QuestionNavigator';
import type { ExamModuleSpec } from '@/lib/examModules';
import { buttonClass } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/Dialog';
import { cn } from '@/components/ui/cn';

interface BottomNavProps {
  testId: string;
  modules: ExamModuleSpec[];
}

/**
 * Bluebook's bottom bar: "Question N of M" in the middle opens the navigator,
 * Back and Next sit on the right. Flag belongs to the question, so
 * it lives in the question's header (see `SplitScreen`).
 *
 * Next on the last question opens "Check your work" (`ModuleReview`), and
 * there the same place holds Finish: a module is only ever finished from the
 * review, with the questions not answered in front of the student.
 *
 * On a phone the three share the width - Back, the navigator, Next - each a
 * full 44px tap target on a touch screen.
 */
export default function BottomNav({ testId, modules }: BottomNavProps) {
  // No subscription to the clock here: the bar must not repaint every second.
  const currentQuestionIndex = useExamStore((state) => state.currentQuestionIndex);
  const currentModuleIndex = useExamStore((state) => state.currentModuleIndex);
  const isReviewOpen = useExamStore((state) => state.isReviewOpen);
  const setCurrentQuestionIndex = useExamStore((state) => state.setCurrentQuestionIndex);
  const setReviewOpen = useExamStore((state) => state.setReviewOpen);
  const finishCurrentModule = useExamStore((state) => state.finishCurrentModule);
  const { isSubmitting, submitExam, submitDialog } = useExamSubmit(testId);
  const { confirm, dismiss: dismissConfirm, dialog: confirmDialog } = useConfirm();
  const [isNavigatorOpen, setNavigatorOpen] = useState(false);
  const navigatorId = useId();
  const navigatorButtonRef = useRef<HTMLButtonElement>(null);

  const moduleCount = modules.length;
  const moduleIndex = Math.min(Math.max(currentModuleIndex, 1), moduleCount);
  const isLastModule = moduleIndex >= moduleCount;
  const questionIds = modules[moduleIndex - 1]?.questionIds ?? [];
  const totalQuestions = questionIds.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  // The number the question pane shows, which clamps the same way.
  const shownQuestionNumber = Math.min(currentQuestionIndex, Math.max(totalQuestions - 1, 0)) + 1;
  const finishLabel = isLastModule ? 'Finish test' : 'Finish module';

  // Stable across renders, so the navigator's chips stay memoized.
  const handleSelectQuestion = useCallback(
    (index: number) => {
      setCurrentQuestionIndex(index);
      setNavigatorOpen(false);
      navigatorButtonRef.current?.focus();
    },
    [setCurrentQuestionIndex]
  );

  const closeNavigator = useCallback(() => setNavigatorOpen(false), []);

  // The clock can send the test while "Finish anyway?" is still open: the
  // question is moot then, and is put away rather than left over the
  // result that is on its way (see the check after it in `handleFinish`).
  useEffect(() => {
    if (isSubmitting) dismissConfirm();
  }, [dismissConfirm, isSubmitting]);

  const openReview = useCallback(() => {
    flushPendingAnswer();
    setNavigatorOpen(false);
    setReviewOpen(true);
  }, [setReviewOpen]);

  const handleNext = () => {
    flushPendingAnswer();

    if (isLastQuestion) {
      openReview();
      return;
    }

    setCurrentQuestionIndex(Math.min(totalQuestions - 1, currentQuestionIndex + 1));
  };

  const handleFinish = async () => {
    flushPendingAnswer();
    const before = useExamStore.getState();
    const unanswered = questionIds.filter((questionId) => !before.answers[questionId]?.trim()).length;

    // Asked only when there is something to lose: a module with every
    // question answered has just been reviewed on this very screen.
    if (unanswered > 0) {
      const isSure = await confirm({
        title: unanswered === 1 ? '1 question is not answered' : `${unanswered} questions are not answered`,
        description: isLastModule
          ? 'A question not answered counts as wrong. Once you finish, your answers are sent and the test ends.'
          : `A question not answered counts as wrong. Once you finish, you cannot come back to Module ${moduleIndex}.`,
        confirmLabel: finishLabel,
        cancelLabel: 'Keep working',
        initialFocus: 'cancel',
      });
      if (!isSure) return;

      // The clock kept running behind the dialog. If it ended the module, or
      // the test, in the meantime, this answer belongs to a screen that is
      // gone: finishing now would end the next module before it began.
      const after = useExamStore.getState();
      if (
        !after.isAttemptLoaded ||
        after.isSubmitted ||
        after.attemptId !== before.attemptId ||
        after.currentModuleIndex !== before.currentModuleIndex ||
        after.modulePhase !== 'active'
      ) {
        return;
      }
    }

    if (isLastModule) {
      void submitExam();
    } else {
      finishCurrentModule();
    }
  };

  // Square on a phone, where it is an icon: as wide as `lg` is tall there,
  // which is 44px on a coarse pointer (see Button.tsx).
  const backButtonClass = buttonClass({
    variant: 'secondary',
    size: 'lg',
    className: 'max-md:order-first max-md:w-10 max-md:px-0 max-md:pointer-coarse:w-11',
  });

  return (
    // The upward shadow is the same one the app shell's bottom bar casts.
    // `z-50`, the header's, so the navigator opens over a tool window.
    <footer className="sticky bottom-0 z-50 flex h-16 shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] sm:px-4 lg:px-6">
      <div className="hidden flex-1 md:block" />

      {/* On the review the grid is on screen, so the navigator steps aside
          and Finish takes its room on a phone. */}
      <div className={cn('relative min-w-0', !isReviewOpen && 'max-md:flex-1')}>
        {!isReviewOpen && (
          <button
            ref={navigatorButtonRef}
            type="button"
            onClick={() => setNavigatorOpen(!isNavigatorOpen)}
            disabled={totalQuestions === 0}
            aria-expanded={isNavigatorOpen}
            aria-haspopup="dialog"
            aria-controls={isNavigatorOpen ? navigatorId : undefined}
            // `pointer-coarse:h-11`, level with Back and Next, which grow to
            // a finger's 44px there (see Button.tsx).
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gray-900 px-4 pointer-coarse:h-11 text-sm font-medium tabular-nums text-white transition-colors hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-600 disabled:pointer-events-none disabled:bg-gray-200 disabled:text-gray-500 max-md:w-full"
          >
            Question {shownQuestionNumber} of {totalQuestions}
            {isNavigatorOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}

        {isNavigatorOpen && !isReviewOpen && (
          <QuestionNavigator
            id={navigatorId}
            questionIds={questionIds}
            currentIndex={currentQuestionIndex}
            moduleIndex={moduleIndex}
            moduleCount={moduleCount}
            onSelect={handleSelectQuestion}
            onClose={closeNavigator}
            onReview={openReview}
            triggerRef={navigatorButtonRef}
          />
        )}
      </div>

      {/* `contents` on a phone, so Back can move to the left edge of the bar
          and the navigator button takes the space between it and Next. */}
      <div className="flex flex-1 items-center justify-end gap-2 max-md:contents">
        {isReviewOpen ? (
          <button
            type="button"
            onClick={() => setReviewOpen(false)}
            disabled={isSubmitting}
            aria-label="Back to the questions"
            title="Back to the questions"
            className={backButtonClass}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden md:inline">Back</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            aria-label="Back"
            title="Back"
            // Hidden, not just disabled, on the first question: a disabled Back is a
            // dead control. `invisible` keeps its box, so the navigator button
            // between it and Next does not jump on a phone.
            className={cn(backButtonClass, currentQuestionIndex === 0 && 'invisible')}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden md:inline">Back</span>
          </button>
        )}

        {isReviewOpen ? (
          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={isSubmitting || totalQuestions === 0}
            className={buttonClass({ size: 'lg', className: 'min-w-24 max-md:flex-1' })}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              <>
                {finishLabel}
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting || totalQuestions === 0}
            className={buttonClass({ size: 'lg', className: 'min-w-24' })}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>

      {confirmDialog}
      {submitDialog}
    </footer>
  );
}
