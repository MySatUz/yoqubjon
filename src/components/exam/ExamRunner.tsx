"use client";

import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import ModuleTransition from '@/components/exam/ModuleTransition';
import ExpiredAttemptNotice from '@/components/exam/ExpiredAttemptNotice';
import { useExamStore } from '@/store/useExamStore';
import { toExamModuleSpecs, type ExamModule } from '@/lib/examModules';

/**
 * Question text arrives as HTML: `/exam/[id]` runs it through KaTeX on the
 * server (see `@/lib/examQuestions`), so nothing in this tree imports `katex`.
 * The strings are produced by `renderMathHtml`, which escapes every plain-text
 * segment itself - they are the only values allowed near
 * `dangerouslySetInnerHTML` here.
 */
export type ExamRunnerQuestion = {
  id: string;
  contentHtml: string;
  /** Empty for grid-in questions. */
  optionsHtml: string[];
  /** Several choices are correct, so the student picks a set. */
  multiSelect: boolean;
  imageUrl: string | null;
};

interface ExamRunnerProps {
  testId: string;
  modules: ExamModule<ExamRunnerQuestion>[];
  /** An admin, outside student view: gets the whiteboard for running a lesson. */
  canDraw?: boolean;
}

export default function ExamRunner({ testId, modules, canDraw = false }: ExamRunnerProps) {
  const specs = useMemo(() => toExamModuleSpecs(modules), [modules]);
  const initializeExam = useExamStore((state) => state.initializeExam);
  const unloadExam = useExamStore((state) => state.unloadExam);
  const startNewAttempt = useExamStore((state) => state.startNewAttempt);
  const continueExpiredAttempt = useExamStore((state) => state.continueExpiredAttempt);
  const syncTimeLeft = useExamStore((state) => state.syncTimeLeft);
  const startCurrentModule = useExamStore((state) => state.startCurrentModule);
  const activeTestId = useExamStore((state) => state.activeTestId);
  const isAttemptLoaded = useExamStore((state) => state.isAttemptLoaded);
  const currentModuleIndex = useExamStore((state) => state.currentModuleIndex);
  const modulePhase = useExamStore((state) => state.modulePhase);
  const isSubmitted = useExamStore((state) => state.isSubmitted);
  const ranOutWhileAway = useExamStore((state) => state.ranOutWhileAway);

  // The saved attempt only exists in the browser, so the server and the first
  // client render both show module 1 and the stored progress lands right after.
  const isHydrated = useSyncExternalStore(
    useCallback((onStoreChange) => useExamStore.persist.onFinishHydration(onStoreChange), []),
    () => useExamStore.persist.hasHydrated(),
    () => false
  );

  // Unloading on the way out is what lets the next exam screen tell this
  // attempt, still in the store, from the one it is about to load.
  useEffect(() => {
    initializeExam(testId, specs);
    return unloadExam;
  }, [initializeExam, specs, testId, unloadExam]);

  // The clock only has to run while a module is counting down. In every other
  // phase `syncTimeLeft` would return `{}`, which zustand still turns into a
  // new state object and broadcasts to every subscriber once a second.
  //
  // This component already subscribes to `modulePhase` and `isSubmitted`, so
  // the moment `startCurrentModule()` flips `pending` -> `active` it re-renders
  // and this effect runs again, calling `syncTimeLeft()` immediately and
  // reinstalling the interval. The clock can never stay stopped.
  //
  // An attempt this screen has not loaded yet - the previous one, still in the
  // store - has no clock to run here, and neither does one whose time ran out
  // while the student was away: it stays at 00:00 until they choose.
  useEffect(() => {
    if (modulePhase !== 'active' || isSubmitted || !isAttemptLoaded || ranOutWhileAway) return;

    syncTimeLeft();
    const interval = setInterval(syncTimeLeft, 1000);
    // A clock that woke up hidden waits for the student to look (see
    // `syncTimeLeft`); this settles it the moment they do.
    document.addEventListener('visibilitychange', syncTimeLeft);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', syncTimeLeft);
    };
  }, [isAttemptLoaded, isSubmitted, modulePhase, ranOutWhileAway, syncTimeLeft]);

  const isReady = isHydrated && isAttemptLoaded && activeTestId === testId;
  const moduleIndex = isReady
    ? Math.min(Math.max(currentModuleIndex, 1), modules.length)
    : 1;
  const activeModule = modules[moduleIndex - 1];
  const isWaitingForModuleStart = isReady && modulePhase === 'pending';
  const isExpiredAttempt = isReady && ranOutWhileAway;

  if (!activeModule) return null;

  return (
    <main className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNav testId={testId} modules={specs} canDraw={canDraw} />
      {isExpiredAttempt ? (
        <ExpiredAttemptNotice
          testId={testId}
          moduleIndex={activeModule.index}
          moduleCount={modules.length}
          onStartOver={() => startNewAttempt(testId, specs)}
          onContinue={continueExpiredAttempt}
        />
      ) : isWaitingForModuleStart ? (
        <ModuleTransition
          moduleIndex={activeModule.index}
          moduleCount={modules.length}
          durationSeconds={activeModule.durationSeconds}
          questionCount={activeModule.questions.length}
          onStart={startCurrentModule}
        />
      ) : (
        <>
          {/* Not before the saved attempt is in: until then the screen shows
              module 1, question 1 whatever the attempt is really on, and the
              board has no attempt to file its drawings under. */}
          <SplitScreen questions={activeModule.questions} canDraw={canDraw && isReady} />
          <BottomNav testId={testId} modules={specs} />
        </>
      )}
    </main>
  );
}
