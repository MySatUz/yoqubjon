"use client";

import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import TopNav from '@/components/exam/TopNav';
import SplitScreen from '@/components/exam/SplitScreen';
import BottomNav from '@/components/exam/BottomNav';
import ModuleTransition from '@/components/exam/ModuleTransition';
import { useExamStore } from '@/store/useExamStore';
import { toExamModuleSpecs, type ExamModule } from '@/lib/examModules';

export type ExamRunnerQuestion = {
  id: string;
  content: string;
  options: unknown;
  imageUrl: string | null;
};

interface ExamRunnerProps {
  testId: string;
  modules: ExamModule<ExamRunnerQuestion>[];
}

export default function ExamRunner({ testId, modules }: ExamRunnerProps) {
  const specs = useMemo(() => toExamModuleSpecs(modules), [modules]);
  const initializeExam = useExamStore((state) => state.initializeExam);
  const syncTimeLeft = useExamStore((state) => state.syncTimeLeft);
  const startCurrentModule = useExamStore((state) => state.startCurrentModule);
  const activeTestId = useExamStore((state) => state.activeTestId);
  const currentModuleIndex = useExamStore((state) => state.currentModuleIndex);
  const modulePhase = useExamStore((state) => state.modulePhase);

  // The saved attempt only exists in the browser, so the server and the first
  // client render both show module 1 and the stored progress lands right after.
  const isHydrated = useSyncExternalStore(
    useCallback((onStoreChange) => useExamStore.persist.onFinishHydration(onStoreChange), []),
    () => useExamStore.persist.hasHydrated(),
    () => false
  );

  useEffect(() => {
    initializeExam(testId, specs);
  }, [initializeExam, specs, testId]);

  useEffect(() => {
    syncTimeLeft();
    const interval = setInterval(syncTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [syncTimeLeft]);

  const isReady = isHydrated && activeTestId === testId;
  const moduleIndex = isReady
    ? Math.min(Math.max(currentModuleIndex, 1), modules.length)
    : 1;
  const activeModule = modules[moduleIndex - 1];
  const isWaitingForModuleStart = isReady && modulePhase === 'pending';

  if (!activeModule) return null;

  return (
    <main className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <TopNav testId={testId} modules={specs} />
      {isWaitingForModuleStart ? (
        <ModuleTransition
          moduleIndex={activeModule.index}
          moduleCount={modules.length}
          durationSeconds={activeModule.durationSeconds}
          questionCount={activeModule.questions.length}
          onStart={startCurrentModule}
        />
      ) : (
        <>
          <SplitScreen questions={activeModule.questions} />
          <BottomNav testId={testId} modules={specs} />
        </>
      )}
    </main>
  );
}
