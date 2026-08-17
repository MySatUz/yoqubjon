import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EXAM_DURATION_SECONDS } from '@/lib/examConfig';
import type { ExamModuleSpec } from '@/lib/examModules';

/**
 * `active` means the module clock is running. `pending` means the previous
 * module is over and the next one has not been started yet, so no time is
 * being consumed: unused time never carries over between modules.
 */
type ModulePhase = 'active' | 'pending';

interface ExamState {
  activeTestId: string | null;
  answers: Record<string, string>;
  markedForReview: Record<string, boolean>;
  moduleDurations: number[];
  moduleTimeSpent: Record<number, number>;
  currentModuleIndex: number;
  modulePhase: ModulePhase;
  moduleDurationSeconds: number;
  timeLeftSeconds: number;
  endsAtMs: number | null;
  currentQuestionIndex: number;
  isSubmitted: boolean;
  isCalculatorOpen: boolean;
  isReferenceOpen: boolean;

  // Actions
  initializeExam: (testId: string, modules: ExamModuleSpec[]) => void;
  startCurrentModule: () => void;
  finishCurrentModule: () => void;
  setAnswer: (questionId: string, answer: string) => void;
  toggleMarkForReview: (questionId: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  syncTimeLeft: () => void;
  markSubmitted: () => void;
  setCalculatorOpen: (open: boolean) => void;
  setReferenceOpen: (open: boolean) => void;
}

const createInitialState = () => ({
  activeTestId: null,
  answers: {} as Record<string, string>,
  markedForReview: {} as Record<string, boolean>,
  moduleDurations: [EXAM_DURATION_SECONDS],
  moduleTimeSpent: {} as Record<number, number>,
  currentModuleIndex: 1,
  modulePhase: 'active' as ModulePhase,
  moduleDurationSeconds: EXAM_DURATION_SECONDS,
  timeLeftSeconds: EXAM_DURATION_SECONDS,
  endsAtMs: null as number | null,
  currentQuestionIndex: 0,
  isSubmitted: false,
  isCalculatorOpen: false,
  isReferenceOpen: false,
});

/** Starts a fresh attempt with module 1 already running. */
function startFirstModule(testId: string, modules: ExamModuleSpec[]) {
  const now = Date.now();
  const durationSeconds = modules[0].durationSeconds;

  return {
    ...createInitialState(),
    activeTestId: testId,
    moduleDurations: modules.map((item) => item.durationSeconds),
    moduleDurationSeconds: durationSeconds,
    timeLeftSeconds: durationSeconds,
    endsAtMs: now + durationSeconds * 1000,
  };
}

/**
 * `persist` writes on every `set()`, including the timer tick and the actions
 * that return `{}`. Most of those serialize to the exact same string, so the
 * write is skipped instead of blocking the main thread on localStorage.
 */
const dedupedStorage = createJSONStorage(() => {
  // Same as the default storage: this throws on the server, and persistence is
  // then skipped entirely.
  const storage = window.localStorage;
  let lastWrittenValue: string | null = null;

  return {
    getItem: (name: string) => storage.getItem(name),
    setItem: (name: string, value: string) => {
      if (value === lastWrittenValue) return;
      lastWrittenValue = value;
      storage.setItem(name, value);
    },
    removeItem: (name: string) => {
      lastWrittenValue = null;
      storage.removeItem(name);
    },
  };
});

export const selectModuleCount = (state: ExamState) => state.moduleDurations.length;

export const selectIsLastModule = (state: ExamState) =>
  state.currentModuleIndex >= state.moduleDurations.length;

/**
 * Time actually spent on the test: every finished module plus the running one.
 * A module the student left early only contributes the time it was open.
 */
export const selectTotalTimeSpent = (state: ExamState) => {
  const finishedSeconds = Object.entries(state.moduleTimeSpent).reduce(
    (total, [moduleIndex, seconds]) => (
      Number(moduleIndex) === state.currentModuleIndex ? total : total + seconds
    ),
    0
  );

  const currentSeconds = state.modulePhase === 'pending'
    ? 0
    : Math.min(
      state.moduleDurationSeconds,
      Math.max(0, state.moduleDurationSeconds - state.timeLeftSeconds)
    );

  return finishedSeconds + currentSeconds;
};

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      ...createInitialState(),

      initializeExam: (testId, modules) =>
        set((state) => {
          if (modules.length === 0) return {};

          // A submitted attempt is never resumed: the next visit is a new
          // attempt that starts module 1 on a fresh clock.
          if (state.activeTestId !== testId || state.isSubmitted) {
            return startFirstModule(testId, modules);
          }

          const now = Date.now();
          const moduleIndex = Math.min(state.currentModuleIndex, modules.length);
          const activeModule = modules[moduleIndex - 1];
          const lastQuestionIndex = Math.max(activeModule.questionIds.length - 1, 0);
          const moduleDurations = modules.map((item) => item.durationSeconds);

          if (state.modulePhase === 'pending') {
            return {
              moduleDurations,
              currentModuleIndex: moduleIndex,
              moduleDurationSeconds: activeModule.durationSeconds,
              timeLeftSeconds: activeModule.durationSeconds,
              endsAtMs: null,
              currentQuestionIndex: 0,
            };
          }

          // `endsAtMs` is the stored source of truth for the running clock;
          // `timeLeftSeconds` is only a live value and is not persisted.
          const remainingSeconds = state.endsAtMs
            ? Math.max(0, Math.ceil((state.endsAtMs - now) / 1000))
            : state.timeLeftSeconds;
          const elapsedSeconds = Math.max(
            0,
            state.moduleDurationSeconds - remainingSeconds
          );
          const durationChanged = state.moduleDurationSeconds !== activeModule.durationSeconds;
          const syncedTimeLeft = state.endsAtMs
            ? remainingSeconds
            : Math.min(remainingSeconds, activeModule.durationSeconds);
          const timeLeftSeconds = durationChanged
            ? Math.max(0, activeModule.durationSeconds - elapsedSeconds)
            : syncedTimeLeft;

          return {
            moduleDurations,
            currentModuleIndex: moduleIndex,
            moduleDurationSeconds: activeModule.durationSeconds,
            timeLeftSeconds,
            endsAtMs: timeLeftSeconds > 0 ? now + timeLeftSeconds * 1000 : now,
            currentQuestionIndex: Math.min(state.currentQuestionIndex, lastQuestionIndex),
          };
        }),

      startCurrentModule: () =>
        set((state) => {
          if (state.modulePhase !== 'pending') return {};

          return {
            modulePhase: 'active' as ModulePhase,
            timeLeftSeconds: state.moduleDurationSeconds,
            endsAtMs: Date.now() + state.moduleDurationSeconds * 1000,
            currentQuestionIndex: 0,
          };
        }),

      finishCurrentModule: () =>
        set((state) => {
          const nextModuleIndex = state.currentModuleIndex + 1;
          const nextDuration = state.moduleDurations[nextModuleIndex - 1];

          // The last module ends with the submission, not with a handover.
          if (nextDuration === undefined) return {};

          const spentSeconds = Math.min(
            state.moduleDurationSeconds,
            Math.max(0, state.moduleDurationSeconds - state.timeLeftSeconds)
          );

          return {
            moduleTimeSpent: {
              ...state.moduleTimeSpent,
              [state.currentModuleIndex]: spentSeconds,
            },
            currentModuleIndex: nextModuleIndex,
            modulePhase: 'pending' as ModulePhase,
            moduleDurationSeconds: nextDuration,
            timeLeftSeconds: nextDuration,
            endsAtMs: null,
            currentQuestionIndex: 0,
          };
        }),

      setAnswer: (questionId, answer) =>
        set((state) => ({
          answers: { ...state.answers, [questionId]: answer }
        })),

      toggleMarkForReview: (questionId) =>
        set((state) => ({
          markedForReview: {
            ...state.markedForReview,
            [questionId]: !state.markedForReview[questionId]
          }
        })),

      setCurrentQuestionIndex: (index) =>
        set(() => ({ currentQuestionIndex: Math.max(0, index) })),

      syncTimeLeft: () =>
        set((state) => {
          if (state.modulePhase !== 'active') return {};

          return {
            timeLeftSeconds: state.endsAtMs
              ? Math.max(0, Math.ceil((state.endsAtMs - Date.now()) / 1000))
              : Math.max(0, state.timeLeftSeconds - 1)
          };
        }),

      // Keeps the finished attempt on screen while the result page loads, and
      // makes the next visit start a new attempt.
      markSubmitted: () => set({ isSubmitted: true }),

      setCalculatorOpen: (open) => set({ isCalculatorOpen: open }),
      setReferenceOpen: (open) => set({ isReferenceOpen: open }),
    }),
    {
      name: 'mysat-exam-storage',
      version: 2,
      storage: dedupedStorage,
      // Attempts saved by the pre-module timer cannot be resumed safely.
      migrate: () => createInitialState() as ExamState,
      partialize: (state) => ({
        activeTestId: state.activeTestId,
        answers: state.answers,
        markedForReview: state.markedForReview,
        moduleDurations: state.moduleDurations,
        moduleTimeSpent: state.moduleTimeSpent,
        currentModuleIndex: state.currentModuleIndex,
        modulePhase: state.modulePhase,
        moduleDurationSeconds: state.moduleDurationSeconds,
        // `timeLeftSeconds` is derived from `endsAtMs` on the next visit, and
        // keeping it out is what makes a timer tick serialize to the same
        // string as the tick before it.
        endsAtMs: state.endsAtMs,
        currentQuestionIndex: state.currentQuestionIndex,
        isSubmitted: state.isSubmitted,
      }),
    }
  )
);
