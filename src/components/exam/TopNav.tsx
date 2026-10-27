"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useExamStore } from '@/store/useExamStore';
import ReferenceModal from '@/components/exam/ReferenceModal';
import { flushPendingAnswer } from '@/components/exam/pendingAnswer';
import { useExamSubmit } from '@/components/exam/useExamSubmit';
import type { ExamModuleSpec } from '@/lib/examModules';
import { BookOpen, Calculator, Clock, PenLine } from 'lucide-react';
import BrandMark from '@/components/layout/BrandMark';
import { buttonClass } from '@/components/ui/Button';
import {
  labelledToolClass,
  toolActiveClass,
  toolButtonClass,
  toolIconClass,
  toolIdleClass,
} from '@/components/exam/toolButtons';
import { cn } from '@/components/ui/cn';

/**
 * The last stretch of a module: the clock turns amber - the system's colour
 * for "expiring" - can no longer be hidden, and says so once to a screen
 * reader. No red and no pulsing: running low is not an error.
 */
const LOW_TIME_SECONDS = 5 * 60;

interface TopNavProps {
  testId: string;
  title: string;
  modules: ExamModuleSpec[];
  /** Shows the whiteboard switch - admins only, see `/exam/[id]`. */
  canDraw?: boolean;
  /** The reference sheet's content, rendered on the server. */
  referenceSheet: React.ReactNode;
}

export default function TopNav({ testId, title, modules, canDraw = false, referenceSheet }: TopNavProps) {
  // The clock lives here, so this is the one component that has to follow
  // `timeLeftSeconds` - the auto handover below depends on it.
  const timeLeftSeconds = useExamStore((state) => state.timeLeftSeconds);
  const modulePhase = useExamStore((state) => state.modulePhase);
  const activeTestId = useExamStore((state) => state.activeTestId);
  const attemptId = useExamStore((state) => state.attemptId);
  const isAttemptLoaded = useExamStore((state) => state.isAttemptLoaded);
  const isSubmitted = useExamStore((state) => state.isSubmitted);
  const ranOutWhileAway = useExamStore((state) => state.ranOutWhileAway);
  const currentModuleIndex = useExamStore((state) => state.currentModuleIndex);
  const isCalculatorOpen = useExamStore((state) => state.isCalculatorOpen);
  const isReferenceOpen = useExamStore((state) => state.isReferenceOpen);
  const isWhiteboardOpen = useExamStore((state) => state.isWhiteboardOpen);
  const isReviewOpen = useExamStore((state) => state.isReviewOpen);
  const finishCurrentModule = useExamStore((state) => state.finishCurrentModule);
  const setCalculatorOpen = useExamStore((state) => state.setCalculatorOpen);
  const setReferenceOpen = useExamStore((state) => state.setReferenceOpen);
  const setWhiteboardOpen = useExamStore((state) => state.setWhiteboardOpen);
  // Finishing is done from "Check your work" (see `BottomNav`); the header
  // only sends the test when the last module's clock runs out.
  const { submitExam, submitDialog } = useExamSubmit(testId);
  const autoEndedModuleRef = useRef<string | null>(null);
  // Bluebook's Hide: only what the clock shows, never whether it runs.
  const [isTimerHidden, setTimerHidden] = useState(false);

  // Until ExamRunner has loaded this test's attempt, the store can still hold
  // the one before it (see `isAttemptLoaded`). Nothing acts on that attempt,
  // and the header shows this test's opening state instead of its numbers: a
  // 00:00 left over from the last test read as this one being over already.
  const isLoadedHere = isAttemptLoaded && activeTestId === testId;
  const isOwnLiveAttempt = isLoadedHere && !isSubmitted;
  const shownModuleIndex = isLoadedHere ? currentModuleIndex : 1;
  const shownTimeLeft = isLoadedHere ? timeLeftSeconds : modules[0]?.durationSeconds ?? 0;

  const moduleCount = modules.length;
  const isLastModule = currentModuleIndex >= moduleCount;
  // Before a module starts, and while the student decides what to do with an
  // attempt whose time ran out while they were away, no clock is running.
  const isPaused = !isLoadedHere || modulePhase === 'pending' || ranOutWhileAway;
  const isLowTime = isOwnLiveAttempt && !isPaused && shownTimeLeft <= LOW_TIME_SECONDS;
  const showsTime = !isTimerHidden || isLowTime;
  // Where there is a question on screen to draw over.
  const showWhiteboardSwitch = canDraw && !isPaused && !isReviewOpen;

  useEffect(() => {
    if (!isOwnLiveAttempt || isPaused || timeLeftSeconds > 0) return;

    // Per attempt, not just per module: a new attempt started on this same
    // screen must still end on its own clock.
    const attemptModule = `${attemptId}:${currentModuleIndex}`;
    if (autoEndedModuleRef.current === attemptModule) return;

    // Time is up: hand over to the next module, or submit the whole test.
    autoEndedModuleRef.current = attemptModule;
    flushPendingAnswer();

    if (isLastModule) {
      void submitExam();
    } else {
      finishCurrentModule();
    }
  }, [
    attemptId,
    currentModuleIndex,
    finishCurrentModule,
    isLastModule,
    isOwnLiveAttempt,
    isPaused,
    submitExam,
    timeLeftSeconds,
  ]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m}:${s}`;
    }

    return `${m}:${s}`;
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 sm:px-4 lg:px-6">
        {/* Where the student is, in words: "Module 1 of 2" on every screen
            size, with the test under it. Kept clear of the centred clock. */}
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[calc(50%-5.5rem)]">
          <span className="hidden lg:block">
            <BrandMark size="sm" />
          </span>
          <div className="min-w-0 leading-tight">
            {moduleCount > 1 && (
              <p className="truncate text-sm font-semibold tabular-nums text-gray-900">
                Module {shownModuleIndex} of {moduleCount}
              </p>
            )}
            <h1
              className={cn(
                'truncate',
                moduleCount > 1 ? 'mt-0.5 text-xs text-gray-500' : 'text-sm font-semibold text-gray-900'
              )}
            >
              {title}
            </h1>
          </div>
        </div>

        {/* From `sm` the clock is centred on the screen and Hide hangs off
            its right, so the clock stays centred whether it shows the time
            or not. Narrower, the two sit together between the sides. */}
        <div className="flex shrink-0 items-center gap-1 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <span
            role="timer"
            className={cn(
              'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-lg font-semibold tabular-nums transition-colors',
              showsTime ? 'px-3' : 'w-9',
              isPaused
                ? 'text-gray-500'
                : isLowTime
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-gray-100 text-gray-900'
            )}
          >
            {showsTime ? (
              <>
                {isLowTime && <Clock className="h-4 w-4" />}
                <span className="sr-only">Time left </span>
                {formatTime(shownTimeLeft)}
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                <span className="sr-only">Timer hidden</span>
              </>
            )}
          </span>
          {/* Kept in its place, only invisible, once the time can no longer
              be hidden: on a phone the clock would jump otherwise. Outlined,
              as Bluebook draws it: as bare grey text beside the clock it read
              as a caption, not a switch. */}
          <button
            type="button"
            onClick={() => setTimerHidden(!isTimerHidden)}
            aria-label={isTimerHidden ? 'Show timer' : 'Hide timer'}
            className={buttonClass({
              variant: 'secondary',
              size: 'sm',
              className: cn(
                'sm:absolute sm:left-full sm:top-1/2 sm:ml-1 sm:-translate-y-1/2',
                isLowTime && 'invisible'
              ),
            })}
          >
            {isTimerHidden ? 'Show' : 'Hide'}
          </button>
          {/* Said once, when the module crosses into its last five minutes -
              or on reopening an attempt already inside them, so not "5". */}
          <p className="sr-only" role="status">
            {isLowTime ? `Less than 5 minutes left${moduleCount > 1 ? ' in this module' : ''}.` : ''}
          </p>
        </div>

        {/* The toggles keep one name whatever their state: `aria-pressed`
            already says open or closed, and a name that flipped to "Close
            ..." was read out as "Close calculator, pressed". */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Admin-only, so it goes on the outside: a student's two tools keep
              their places. */}
          {showWhiteboardSwitch && (
            <button
              type="button"
              onClick={() => setWhiteboardOpen(!isWhiteboardOpen)}
              aria-pressed={isWhiteboardOpen}
              aria-label="Whiteboard"
              title="Whiteboard"
              className={`${toolButtonClass} ${isWhiteboardOpen ? toolActiveClass : toolIdleClass}`}
            >
              <PenLine className={toolIconClass} />
            </button>
          )}
          {/* A window beside the question now, not a modal over it, so it is a
              toggle like the calculator - and the two can be open together. */}
          <button
            type="button"
            onClick={() => setReferenceOpen(!isReferenceOpen)}
            aria-pressed={isReferenceOpen}
            aria-label="Reference sheet"
            title="Reference sheet"
            className={cn(labelledToolClass, isReferenceOpen ? toolActiveClass : toolIdleClass)}
          >
            <BookOpen className={toolIconClass} />
            <span className="hidden xl:inline">Reference</span>
          </button>
          {/* The calculator's window lives with the question (see
              `SplitScreen`), so on a start screen or the expired-attempt
              notice it waits: pressed there, it lit up and showed nothing.
              The reference sheet opens anywhere. */}
          <button
            type="button"
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            disabled={isPaused}
            aria-pressed={isCalculatorOpen}
            aria-label="Graphing calculator"
            title={
              isPaused
                ? `The calculator opens once the ${moduleCount > 1 ? 'module' : 'test'} starts`
                : 'Graphing calculator'
            }
            className={cn(labelledToolClass, isCalculatorOpen ? toolActiveClass : toolIdleClass)}
          >
            <Calculator className={toolIconClass} />
            <span className="hidden xl:inline">Calculator</span>
          </button>
        </div>
      </header>

      <ReferenceModal isOpen={isReferenceOpen} onClose={() => setReferenceOpen(false)}>
        {referenceSheet}
      </ReferenceModal>
      {submitDialog}
    </>
  );
}
