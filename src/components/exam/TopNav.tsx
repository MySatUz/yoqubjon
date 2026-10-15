"use client";

import React, { useEffect, useRef } from 'react';
import { useExamStore } from '@/store/useExamStore';
import ReferenceModal from '@/components/exam/ReferenceModal';
import { flushPendingAnswer } from '@/components/exam/pendingAnswer';
import { useExamSubmit } from '@/components/exam/useExamSubmit';
import type { ExamModuleSpec } from '@/lib/examModules';
import { BookOpen, Calculator, PenLine } from 'lucide-react';

/**
 * The exam tools are icons at every width, each named by its tooltip and
 * label: spelled out, "Reference Sheet" and "Graphing Calculator" left no room
 * on a 1024px screen for a third tool beside the centred clock.
 */
const toolButtonClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors';
const toolIdleClass = 'text-slate-700 hover:bg-slate-100';
const toolActiveClass = 'bg-blue-100 text-blue-700';
const toolIconClass = 'h-4 w-4 sm:h-5 sm:w-5';

interface TopNavProps {
  testId: string;
  modules: ExamModuleSpec[];
  /** Shows the whiteboard switch - admins only, see `/exam/[id]`. */
  canDraw?: boolean;
}

export default function TopNav({ testId, modules, canDraw = false }: TopNavProps) {
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
  const currentQuestionIndex = useExamStore((state) => state.currentQuestionIndex);
  const isCalculatorOpen = useExamStore((state) => state.isCalculatorOpen);
  const isReferenceOpen = useExamStore((state) => state.isReferenceOpen);
  const isWhiteboardOpen = useExamStore((state) => state.isWhiteboardOpen);
  const finishCurrentModule = useExamStore((state) => state.finishCurrentModule);
  const setCalculatorOpen = useExamStore((state) => state.setCalculatorOpen);
  const setReferenceOpen = useExamStore((state) => state.setReferenceOpen);
  const setWhiteboardOpen = useExamStore((state) => state.setWhiteboardOpen);
  const { isSubmitting, submitExam } = useExamSubmit(testId);
  const autoEndedModuleRef = useRef<string | null>(null);

  // Until ExamRunner has loaded this test's attempt, the store can still hold
  // the one before it (see `isAttemptLoaded`). Nothing acts on that attempt,
  // and the header shows this test's opening state instead of its numbers: a
  // 00:00 left over from the last test read as this one being over already.
  const isLoadedHere = isAttemptLoaded && activeTestId === testId;
  const isOwnLiveAttempt = isLoadedHere && !isSubmitted;
  const shownModuleIndex = isLoadedHere ? currentModuleIndex : 1;
  const shownQuestionIndex = isLoadedHere ? currentQuestionIndex : 0;
  const shownTimeLeft = isLoadedHere ? timeLeftSeconds : modules[0]?.durationSeconds ?? 0;

  const moduleCount = modules.length;
  const isLastModule = currentModuleIndex >= moduleCount;
  // Between modules, and while the student decides what to do with an attempt
  // whose time ran out while they were away, no clock is running.
  const isPaused = isLoadedHere && (modulePhase === 'pending' || ranOutWhileAway);
  // Between modules there is no question on screen to draw over.
  const showWhiteboardSwitch = canDraw && !isPaused;

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

  const handleEndModule = () => {
    flushPendingAnswer();

    if (isLastModule) {
      void submitExam(
        timeLeftSeconds === 0
          ? undefined
          : "Are you sure you want to end this section? Your answers will be saved."
      );
      return;
    }

    if (
      timeLeftSeconds === 0 ||
      confirm(
        `Are you sure you want to end Module ${currentModuleIndex}? Remaining time will not be added to the next module.`
      )
    ) {
      finishCurrentModule();
    }
  };

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
      <header className="relative h-14 bg-white border-b border-slate-200 flex items-center justify-between gap-2 px-2 sm:px-4 sticky top-0 z-50 shrink-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <h1 className="hidden font-semibold text-slate-900 tracking-tight sm:block">MYSATuz</h1>
          {moduleCount > 1 && (
            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-blue-700 sm:px-3">
              <span className="sm:hidden">M {shownModuleIndex}/{moduleCount}</span>
              <span className="hidden sm:inline">Module {shownModuleIndex} of {moduleCount}</span>
            </span>
          )}
          {!isPaused && (
            <span className="truncate text-xs font-medium text-slate-900 uppercase tracking-widest sm:text-sm">
              <span className="sm:hidden">Q {shownQuestionIndex + 1}</span>
              <span className="hidden sm:inline">Question {shownQuestionIndex + 1}</span>
            </span>
          )}
        </div>

        <div className="flex flex-col items-center sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <span className={`rounded-full border px-3 py-1 text-base font-semibold tabular-nums shadow-sm sm:px-4 sm:text-lg ${
            isPaused
              ? 'border-slate-200 bg-white text-slate-400'
              : 'border-slate-100 bg-slate-50 text-slate-900'
          }`}>
            {formatTime(shownTimeLeft)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Admin-only, so it goes on the outside: a student's two tools keep
              their places. */}
          {showWhiteboardSwitch && (
            <button
              type="button"
              onClick={() => setWhiteboardOpen(!isWhiteboardOpen)}
              aria-pressed={isWhiteboardOpen}
              aria-label={isWhiteboardOpen ? 'Close Whiteboard' : 'Whiteboard'}
              title={isWhiteboardOpen ? 'Close Whiteboard' : 'Whiteboard'}
              className={`${toolButtonClass} ${isWhiteboardOpen ? toolActiveClass : toolIdleClass}`}
            >
              <PenLine className={toolIconClass} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setReferenceOpen(true)}
            aria-label="Reference Sheet"
            title="Reference Sheet"
            className={`${toolButtonClass} ${toolIdleClass}`}
          >
            <BookOpen className={toolIconClass} />
          </button>
          <button
            type="button"
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            aria-pressed={isCalculatorOpen}
            aria-label={isCalculatorOpen ? 'Close Calculator' : 'Graphing Calculator'}
            title={isCalculatorOpen ? 'Close Calculator' : 'Graphing Calculator'}
            className={`${toolButtonClass} ${isCalculatorOpen ? toolActiveClass : toolIdleClass}`}
          >
            <Calculator className={toolIconClass} />
          </button>
          {!isPaused && (
            <>
              <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
              <button
                onClick={handleEndModule}
                disabled={isSubmitting}
                className="rounded px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 sm:px-3 sm:text-sm"
              >
                {isSubmitting ? 'Submitting...' : shownModuleIndex >= moduleCount ? (
                  <><span className="sm:hidden">End</span><span className="hidden sm:inline">End Section</span></>
                ) : (
                  <><span className="sm:hidden">End</span><span className="hidden sm:inline">End Module</span></>
                )}
              </button>
            </>
          )}
        </div>
      </header>

      <ReferenceModal isOpen={isReferenceOpen} onClose={() => setReferenceOpen(false)} />
    </>
  );
}
