import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EXAM_DURATION_SECONDS, EXAM_TIME_GRACE_SECONDS } from '@/lib/examConfig';
import type { ExamModuleSpec } from '@/lib/examModules';

/**
 * `active` means the module clock is running. `pending` means the previous
 * module is over and the next one has not been started yet, so no time is
 * being consumed: unused time never carries over between modules.
 */
type ModulePhase = 'active' | 'pending';

interface ExamState {
  activeTestId: string | null;
  /**
   * Names one attempt, so anything kept per attempt - the admin whiteboard's
   * drawings - can tell a resumed attempt from a new attempt at the same test.
   */
  attemptId: string | null;
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
  /**
   * The attempt whose result is on its way to the server. Not persisted.
   *
   * Kept here rather than in each copy of `useExamSubmit` - the header, the
   * footer and the expired-attempt notice each hold one - so that all of them
   * see one send, and so the clock knows not to settle an attempt that is
   * being sent: a phone locked right after Finish wakes up long past the
   * deadline with the request still out.
   */
  sendingAttemptId: string | null;
  /**
   * The attempt in the store is the one the exam screen on the page has
   * loaded: set by `initializeExam`, cleared by `unloadExam` when that screen
   * goes away. Not persisted.
   *
   * The store is a module singleton, so it outlives the page. After a test
   * that ended on its clock, the next exam screen mounts on that attempt -
   * 00:00, submitted - and the header's effects run before ExamRunner's
   * `initializeExam` replaces it, because a child's effects run before its
   * parent's. Nothing may end a module or submit until this is set.
   */
  isAttemptLoaded: boolean;
  /**
   * The attempt's clock ran out while nothing was running it: the test was
   * closed, more than a grace period before it was opened again, or the page
   * was frozen or asleep. The exam screen then asks what to do with it
   * instead of submitting it, or handing over to the next module, the moment
   * the student is back. Not persisted: `initializeExam` works it out again
   * from `endsAtMs` on every visit.
   */
  ranOutWhileAway: boolean;
  isCalculatorOpen: boolean;
  isReferenceOpen: boolean;
  isWhiteboardOpen: boolean;

  // Actions
  initializeExam: (testId: string, modules: ExamModuleSpec[]) => void;
  unloadExam: () => void;
  startSending: (attemptId: string) => void;
  stopSending: (attemptId: string) => void;
  startNewAttempt: (testId: string, modules: ExamModuleSpec[]) => void;
  continueExpiredAttempt: () => void;
  startCurrentModule: () => void;
  finishCurrentModule: () => void;
  setAnswer: (questionId: string, answer: string) => void;
  toggleAnswerChoice: (questionId: string, letter: string) => void;
  toggleMarkForReview: (questionId: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  syncTimeLeft: () => void;
  markSubmitted: () => void;
  setCalculatorOpen: (open: boolean) => void;
  setReferenceOpen: (open: boolean) => void;
  setWhiteboardOpen: (open: boolean) => void;
}

const createInitialState = () => ({
  activeTestId: null,
  attemptId: null as string | null,
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
  sendingAttemptId: null as string | null,
  isAttemptLoaded: false,
  ranOutWhileAway: false,
  isCalculatorOpen: false,
  isReferenceOpen: false,
  isWhiteboardOpen: false,
});

/** Unique within one browser, which is as far as an attempt in localStorage goes. */
function createAttemptId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Starts a fresh attempt with module 1 already running. */
function startFirstModule(testId: string, moduleDurations: number[]) {
  const now = Date.now();
  const durationSeconds = moduleDurations[0];

  return {
    ...createInitialState(),
    activeTestId: testId,
    attemptId: createAttemptId(),
    moduleDurations,
    moduleDurationSeconds: durationSeconds,
    timeLeftSeconds: durationSeconds,
    endsAtMs: now + durationSeconds * 1000,
    isAttemptLoaded: true,
  };
}

/**
 * An attempt with nothing answered has nothing to keep. When its clock runs
 * out while the student is away it is replaced by a new attempt rather than
 * filed as a blank result, which would use up an attempt and push their real
 * one off the dashboard.
 */
function hasAnyAnswer(answers: Record<string, string>) {
  return Object.values(answers).some((answer) => answer.trim() !== '');
}

/**
 * How late a running clock may notice its deadline and still end the module
 * as usual. A visible page ticks every second, and a hidden one at least once
 * a minute (Chrome's throttling of background tabs), so anything later means
 * nothing was running the page: a phone switched to another app, a closed
 * laptop lid.
 */
const WOKE_PAST_DEADLINE_MS = 2 * 60 * 1000;

function isPageHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
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

          const moduleDurations = modules.map((item) => item.durationSeconds);

          // A submitted attempt is never resumed: the next visit is a new
          // attempt that starts module 1 on a fresh clock.
          if (state.activeTestId !== testId || state.isSubmitted) {
            return startFirstModule(testId, moduleDurations);
          }

          const now = Date.now();
          const moduleIndex = Math.min(state.currentModuleIndex, modules.length);
          const activeModule = modules[moduleIndex - 1];
          const lastQuestionIndex = Math.max(activeModule.questionIds.length - 1, 0);

          // An attempt saved before attempts had ids gets one on resume.
          const attemptId = state.attemptId ?? createAttemptId();

          if (state.modulePhase === 'pending') {
            return {
              attemptId,
              moduleDurations,
              currentModuleIndex: moduleIndex,
              moduleDurationSeconds: activeModule.durationSeconds,
              timeLeftSeconds: activeModule.durationSeconds,
              endsAtMs: null,
              currentQuestionIndex: 0,
              isAttemptLoaded: true,
              ranOutWhileAway: false,
            };
          }

          // The module's deadline, moved along with its duration if an admin
          // changed that since the module started.
          const deadlineMs = state.endsAtMs === null
            ? null
            : state.endsAtMs + (activeModule.durationSeconds - state.moduleDurationSeconds) * 1000;

          // Past the deadline by more than the grace period: the clock ran
          // out while the test was closed - the student left yesterday and is
          // opening it again today - not during a reload in the module's last
          // seconds, which still ends the module as usual.
          if (deadlineMs !== null && now - deadlineMs > EXAM_TIME_GRACE_SECONDS * 1000) {
            if (!hasAnyAnswer(state.answers)) {
              return startFirstModule(testId, moduleDurations);
            }

            return {
              attemptId,
              moduleDurations,
              currentModuleIndex: moduleIndex,
              moduleDurationSeconds: activeModule.durationSeconds,
              timeLeftSeconds: 0,
              // Kept as the deadline rather than reset to now, so a reload on
              // the question screen asks again instead of ending the module.
              endsAtMs: deadlineMs,
              currentQuestionIndex: Math.min(state.currentQuestionIndex, lastQuestionIndex),
              isAttemptLoaded: true,
              ranOutWhileAway: true,
            };
          }

          // `endsAtMs` is the stored source of truth for the running clock;
          // `timeLeftSeconds` is only a live value and is not persisted. Read
          // through the same moved deadline as the check above, so the two
          // cannot disagree about how much time is left.
          const timeLeftSeconds = deadlineMs !== null
            ? Math.min(
              activeModule.durationSeconds,
              Math.max(0, Math.ceil((deadlineMs - now) / 1000))
            )
            : Math.min(state.timeLeftSeconds, activeModule.durationSeconds);

          return {
            attemptId,
            moduleDurations,
            currentModuleIndex: moduleIndex,
            moduleDurationSeconds: activeModule.durationSeconds,
            timeLeftSeconds,
            endsAtMs: timeLeftSeconds > 0 ? now + timeLeftSeconds * 1000 : now,
            currentQuestionIndex: Math.min(state.currentQuestionIndex, lastQuestionIndex),
            isAttemptLoaded: true,
            ranOutWhileAway: false,
          };
        }),

      unloadExam: () => set({ isAttemptLoaded: false, ranOutWhileAway: false }),

      startSending: (attemptId) => set({ sendingAttemptId: attemptId }),

      // Only the send that started it ends it: a slow answer for an attempt
      // the student has since replaced must not clear the next one's.
      stopSending: (attemptId) =>
        set((state) => (state.sendingAttemptId === attemptId ? { sendingAttemptId: null } : {})),

      // Abandoning an attempt is already free - attempts only count once they
      // are submitted, and opening another test discards the saved one - so
      // offering it here opens no new way around the clock.
      startNewAttempt: (testId, modules) =>
        set(() => (
          modules.length === 0
            ? {}
            : startFirstModule(testId, modules.map((item) => item.durationSeconds))
        )),

      // For a module before the last one. Leaves the clock at 00:00, so the
      // header hands over to the next module the way it would have had the
      // test been open when the time ran out. The last module is submitted
      // from the notice itself instead, which stays up while that is sent.
      continueExpiredAttempt: () =>
        set((state) => (state.ranOutWhileAway ? { ranOutWhileAway: false } : {})),

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

      /**
       * Adds or removes one choice on a multi-select question. The selection
       * stays a plain string - sorted letters joined by commas, the same form
       * the answer key uses - so a saved attempt from before multi-select
       * still rehydrates and the submit payload keeps its shape.
       */
      toggleAnswerChoice: (questionId, letter) =>
        set((state) => {
          const selected = new Set(
            (state.answers[questionId] ?? '').split(',').map((part) => part.trim()).filter(Boolean)
          );

          if (selected.has(letter)) selected.delete(letter);
          else selected.add(letter);

          return {
            answers: { ...state.answers, [questionId]: [...selected].sort().join(',') },
          };
        }),

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
          if (state.modulePhase !== 'active' || state.ranOutWhileAway) return {};

          const now = Date.now();

          // A clock that was still running and now finds itself well past its
          // deadline was frozen or asleep, not counting down in front of the
          // student. That is the same as reopening the test later, so it is
          // settled the way `initializeExam` settles it, rather than ending
          // the module the moment the student looks at the page again.
          if (
            state.activeTestId !== null &&
            state.timeLeftSeconds > 0 &&
            state.endsAtMs !== null &&
            now - state.endsAtMs > WOKE_PAST_DEADLINE_MS
          ) {
            // Settled only where the student can see it, and never in the
            // middle of a send. Until then the clock is left as it was, so this
            // keeps waiting: a hidden tab woken overnight that restarted here
            // would run the new attempt's clock with nobody watching, and file
            // the very blank result this exists to prevent.
            const isSending = state.sendingAttemptId !== null
              && state.sendingAttemptId === state.attemptId;
            if (isPageHidden() || isSending) return {};

            return hasAnyAnswer(state.answers)
              ? { timeLeftSeconds: 0, ranOutWhileAway: true }
              : startFirstModule(state.activeTestId, state.moduleDurations);
          }

          return {
            timeLeftSeconds: state.endsAtMs
              ? Math.max(0, Math.ceil((state.endsAtMs - now) / 1000))
              : Math.max(0, state.timeLeftSeconds - 1)
          };
        }),

      // Keeps the finished attempt on screen while the result page loads, and
      // makes the next visit start a new attempt.
      markSubmitted: () => set({ isSubmitted: true }),

      setCalculatorOpen: (open) => set({ isCalculatorOpen: open }),
      setReferenceOpen: (open) => set({ isReferenceOpen: open }),
      setWhiteboardOpen: (open) => set({ isWhiteboardOpen: open }),
    }),
    {
      name: 'mysat-exam-storage',
      version: 2,
      storage: dedupedStorage,
      // Attempts saved by the pre-module timer cannot be resumed safely.
      migrate: () => createInitialState() as ExamState,
      partialize: (state) => ({
        activeTestId: state.activeTestId,
        attemptId: state.attemptId,
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
