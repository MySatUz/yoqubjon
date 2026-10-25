"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import ModuleReview from '@/components/exam/ModuleReview';
import ModuleTransition, { ModuleTransitionSkeleton } from '@/components/exam/ModuleTransition';
import ExpiredAttemptNotice from '@/components/exam/ExpiredAttemptNotice';
import { useExamStore } from '@/store/useExamStore';
import { toExamModuleSpecs, type ExamModule } from '@/lib/examModules';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { rememberOlympiadReturn } from '@/components/exam/olympiadReturn';

/**
 * Question text arrives as HTML: `/exam/[id]` runs it through KaTeX on the
 * server (see `@/lib/examQuestions`), so nothing in this tree imports `katex`
 * up front. The strings are produced by `renderMathHtml`, which escapes every
 * plain-text segment itself - they are the only values allowed near
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
  title: string;
  modules: ExamModule<ExamRunnerQuestion>[];
  /** An admin, outside student view: gets the whiteboard for running a lesson. */
  canDraw?: boolean;
  /** Whose attempt this is: an attempt left in the browser by another account is not resumed. */
  userId: string;
  /** An olympiad's closing time, in ms; null for an ordinary test. */
  olympiadEndsAtMs?: number | null;
  /** The reference sheet's content, rendered on the server (see `ReferenceSheet`). */
  referenceSheet: React.ReactNode;
}

export default function ExamRunner({
  testId,
  title,
  modules,
  canDraw = false,
  userId,
  olympiadEndsAtMs = null,
  referenceSheet,
}: ExamRunnerProps) {
  const router = useRouter();
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
  const blockingAttempt = useExamStore((state) => state.blockingAttempt);
  const isReviewOpen = useExamStore((state) => state.isReviewOpen);
  // "Continue it" leaves for the other test; the dialog waits for that page.
  // Kept as the test being left for, so the wait ends with the question it
  // answered: should this screen outlive the move, a later question about
  // another attempt does not open already busy.
  const [leavingFor, setLeavingFor] = useState<string | null>(null);
  const isLeaving = leavingFor !== null && leavingFor === blockingAttempt?.testId;

  // The saved attempt only exists in the browser, so the server and the first
  // client render cannot know what to show; the body stays empty until the
  // stored progress lands right after.
  const isHydrated = useSyncExternalStore(
    useCallback((onStoreChange) => useExamStore.persist.onFinishHydration(onStoreChange), []),
    () => useExamStore.persist.hasHydrated(),
    () => false
  );

  // Unloading on the way out is what lets the next exam screen tell this
  // attempt, still in the store, from the one it is about to load.
  useEffect(() => {
    initializeExam(testId, specs, userId, title);
    return unloadExam;
  }, [initializeExam, specs, testId, title, unloadExam, userId]);

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

  // An olympiad's last start time must not lock out a student who is already
  // in: while this screen holds their attempt, a reload brings them back here
  // rather than to the olympiad page (see `olympiadReturn`). Taken away once
  // the attempt is sent.
  useEffect(() => {
    if (olympiadEndsAtMs === null || !isReady) return;
    rememberOlympiadReturn(testId, isSubmitted ? null : userId, olympiadEndsAtMs);
  }, [isReady, isSubmitted, olympiadEndsAtMs, testId, userId]);

  const moduleIndex = isReady
    ? Math.min(Math.max(currentModuleIndex, 1), modules.length)
    : 1;
  const activeModule = modules[moduleIndex - 1];
  const isWaitingForModuleStart = isReady && modulePhase === 'pending';
  const isExpiredAttempt = isReady && ranOutWhileAway;
  const nextModule = modules[moduleIndex] ?? null;
  // What a full attempt still needs from this module's Start: an olympiad's
  // start screen weighs it against the time before the window closes.
  const secondsToFinish = modules
    .slice(moduleIndex - 1)
    .reduce((total, item) => total + item.durationSeconds, 0);

  if (!activeModule) return null;

  const otherTitle = blockingAttempt?.title ?? null;

  return (
    // `h-dvh`, not `h-screen`: on a phone 100vh reaches under the browser's
    // own toolbar and hides the bottom bar with Next on it.
    <main className="flex h-dvh flex-col overflow-hidden bg-mist-100">
      <TopNav testId={testId} title={title} modules={specs} canDraw={canDraw} referenceSheet={referenceSheet} />
      {!isReady ? (
        // No question until the attempt is in: question 1 must not be
        // readable before Start, and a resumed attempt is not on question 1
        // at all. Blank under the "unfinished test" question.
        blockingAttempt ? <div className="flex-1" /> : <ModuleTransitionSkeleton />
      ) : isExpiredAttempt ? (
        <ExpiredAttemptNotice
          testId={testId}
          moduleIndex={activeModule.index}
          moduleCount={modules.length}
          onStartOver={() => startNewAttempt(testId, specs, userId, title)}
          onContinue={continueExpiredAttempt}
        />
      ) : isWaitingForModuleStart ? (
        <ModuleTransition
          title={title}
          moduleIndex={activeModule.index}
          moduleCount={modules.length}
          durationSeconds={activeModule.durationSeconds}
          secondsToFinish={secondsToFinish}
          questionCount={activeModule.questions.length}
          olympiadEndsAtMs={olympiadEndsAtMs}
          onStart={startCurrentModule}
        />
      ) : (
        <>
          {/* Only once the attempt is in, so the board files its drawings
              under this attempt. The review takes the question's place
              inside the split screen, so a calculator open beside it stays
              open, graphs and all. */}
          <SplitScreen
            questions={activeModule.questions}
            canDraw={canDraw}
            review={isReviewOpen ? (
              <ModuleReview
                questionIds={specs[moduleIndex - 1]?.questionIds ?? []}
                moduleIndex={activeModule.index}
                moduleCount={modules.length}
                nextModuleSeconds={nextModule?.durationSeconds ?? null}
              />
            ) : null}
          />
          <BottomNav testId={testId} modules={specs} />
        </>
      )}

      {/* Opening this test used to discard another test's attempt without a
          word. Escape and "Continue it" keep it: nothing is lost by default. */}
      <ConfirmDialog
        open={blockingAttempt !== null}
        busy={isLeaving}
        busyButton="cancel"
        title="You have an unfinished test"
        description={
          <p>
            You have an unfinished attempt on{' '}
            {otherTitle ? <span className="font-medium text-mist-900">{otherTitle}</span> : 'another test'}.
            Continue it, or discard it and start this test.
          </p>
        }
        confirmLabel="Discard and start this test"
        cancelLabel="Continue it"
        tone="danger"
        onConfirm={() => startNewAttempt(testId, specs, userId, title)}
        onCancel={() => {
          if (!blockingAttempt || isLeaving) return;
          setLeavingFor(blockingAttempt.testId);
          router.push(`/exam/${blockingAttempt.testId}`);
        }}
      />
    </main>
  );
}
