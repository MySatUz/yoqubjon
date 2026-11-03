import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EXAM_DURATION_SECONDS, EXAM_TIME_GRACE_SECONDS, MAX_UNTIMED_TIME_SPENT_SECONDS } from '@/lib/examConfig';
import type { ExamModuleSpec } from '@/lib/examModules';

/**
 * `active` means the module clock is running. `pending` means the module has
 * not been started yet - module 1 of a new attempt, or the next module after
 * the previous one ended - so no time is being consumed: the clock starts on
 * the student's Start, and unused time never carries over between modules.
 */
type ModulePhase = 'active' | 'pending';

/** Another test's unfinished attempt that opening this test would replace. */
export type BlockingAttempt = { testId: string; title: string | null };

interface ExamState {
  activeTestId: string | null;
  /**
   * The test's title, kept with the attempt so another test's exam screen can
   * name it before replacing it (see `blockingAttempt`). Null on attempts
   * saved before this existed.
   */
  activeTestTitle: string | null;
  /**
   * The account the saved attempt belongs to. On a shared computer the next
   * student must not open the previous one's unfinished attempt - answers,
   * clock and all - and submit it as their own. Null on attempts saved before
   * this existed; those are resumed as before, so nobody mid-exam loses one.
   */
  ownerId: string | null;
  /**
   * Names one attempt, so anything kept per attempt - the admin whiteboard's
   * drawings - can tell a resumed attempt from a new attempt at the same test.
   */
  attemptId: string | null;
  answers: Record<string, string>;
  markedForReview: Record<string, boolean>;
  /**
   * Choices the student has ruled out, by question: a working note on the
   * screen, like a pencil line on paper. Kept with the attempt so it survives
   * a reload, and never part of the answers that are sent.
   */
  crossedOut: Record<string, string[]>;
  moduleDurations: number[];
  moduleTimeSpent: Record<number, number>;
  currentModuleIndex: number;
  modulePhase: ModulePhase;
  moduleDurationSeconds: number;
  timeLeftSeconds: number;
  endsAtMs: number | null;
  /**
   * The test has no time limit: nothing counts down and nothing ends a module
   * but the student. The time used is still recorded, counted up instead.
   */
  untimed: boolean;
  /**
   * With no time limit: the running module's time used, counted up to
   * `checkpointMs`. Moved on at most every CHECKPOINT_MS, so a tick does not
   * rewrite the saved attempt every second.
   */
  elapsedMs: number;
  checkpointMs: number | null;
  /** With no time limit: the running module's time used, live, for the header. Not persisted. */
  elapsedSeconds: number;
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
  /**
   * Set by `initializeExam` instead of replacing an attempt this student has
   * started on another test: the exam screen asks whether to continue that
   * one or discard it. Opening a test used to wipe it without a word. Not
   * persisted.
   */
  blockingAttempt: BlockingAttempt | null;
  /** "Check your work" is on screen instead of the question. Not persisted. */
  isReviewOpen: boolean;
  isCalculatorOpen: boolean;
  isReferenceOpen: boolean;
  isWhiteboardOpen: boolean;

  // Actions
  initializeExam: (testId: string, modules: ExamModuleSpec[], ownerId: string, title: string, untimed: boolean) => void;
  unloadExam: () => void;
  startSending: (attemptId: string) => void;
  stopSending: (attemptId: string) => void;
  startNewAttempt: (testId: string, modules: ExamModuleSpec[], ownerId: string, title: string, untimed: boolean) => void;
  continueExpiredAttempt: () => void;
  startCurrentModule: () => void;
  finishCurrentModule: () => void;
  setAnswer: (questionId: string, answer: string) => void;
  toggleAnswerChoice: (questionId: string, letter: string) => void;
  toggleMarkForReview: (questionId: string) => void;
  toggleCrossOut: (questionId: string, letter: string) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setReviewOpen: (open: boolean) => void;
  syncTimeLeft: () => void;
  markSubmitted: () => void;
  setCalculatorOpen: (open: boolean) => void;
  setReferenceOpen: (open: boolean) => void;
  setWhiteboardOpen: (open: boolean) => void;
}

const createInitialState = () => ({
  activeTestId: null,
  activeTestTitle: null as string | null,
  ownerId: null as string | null,
  attemptId: null as string | null,
  answers: {} as Record<string, string>,
  markedForReview: {} as Record<string, boolean>,
  crossedOut: {} as Record<string, string[]>,
  moduleDurations: [EXAM_DURATION_SECONDS],
  moduleTimeSpent: {} as Record<number, number>,
  currentModuleIndex: 1,
  modulePhase: 'active' as ModulePhase,
  moduleDurationSeconds: EXAM_DURATION_SECONDS,
  timeLeftSeconds: EXAM_DURATION_SECONDS,
  endsAtMs: null as number | null,
  untimed: false,
  elapsedMs: 0,
  checkpointMs: null as number | null,
  elapsedSeconds: 0,
  currentQuestionIndex: 0,
  isSubmitted: false,
  sendingAttemptId: null as string | null,
  isAttemptLoaded: false,
  ranOutWhileAway: false,
  blockingAttempt: null as BlockingAttempt | null,
  isReviewOpen: false,
  isCalculatorOpen: false,
  isReferenceOpen: false,
  isWhiteboardOpen: false,
});

/** Unique within one browser, which is as far as an attempt in localStorage goes. */
function createAttemptId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A fresh attempt, waiting on module 1's start screen. Its clock starts only
 * when the student presses Start (`startCurrentModule`): it used to start the
 * moment the test opened, so time went while the page loaded and while the
 * student was still reading what the test was.
 */
function createAttempt(
  testId: string,
  moduleDurations: number[],
  ownerId: string | null,
  title: string | null,
  untimed: boolean
) {
  const durationSeconds = moduleDurations[0];

  return {
    ...createInitialState(),
    activeTestId: testId,
    activeTestTitle: title,
    ownerId,
    attemptId: createAttemptId(),
    moduleDurations,
    modulePhase: 'pending' as ModulePhase,
    moduleDurationSeconds: durationSeconds,
    timeLeftSeconds: durationSeconds,
    endsAtMs: null,
    untimed,
    isAttemptLoaded: true,
  };
}

/** A choice answer as a set of letters: `"B"` or `"A,C"`. */
function readLetters(answer: string | undefined) {
  return new Set((answer ?? '').split(',').map((part) => part.trim()).filter(Boolean));
}

/** Choosing a crossed-out choice brings it back: the student changed their mind. */
function uncross(crossedOut: Record<string, string[]>, questionId: string, letters: Iterable<string>) {
  const crossed = crossedOut[questionId];
  if (!crossed) return crossedOut;

  const chosen = new Set(letters);
  const kept = crossed.filter((letter) => !chosen.has(letter));
  if (kept.length === crossed.length) return crossedOut;

  const next = { ...crossedOut };
  if (kept.length > 0) next[questionId] = kept;
  else delete next[questionId];
  return next;
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
 * With no time limit, how often the time used is saved with the attempt. The
 * header reads it live every second; the saved copy only has to survive a
 * reload.
 */
const CHECKPOINT_MS = 15 * 1000;

/**
 * The time used on a module with no time limit, brought up to `now`. A gap
 * longer than WOKE_PAST_DEADLINE_MS means nothing was running the page - a
 * closed laptop, the test closed and opened again tomorrow - and is not
 * counted. A hidden tab still ticks at least once a minute, so time spent in
 * another tab (a calculator, a worksheet) is.
 */
function advanceElapsed(state: { elapsedMs: number; checkpointMs: number | null }, now: number) {
  const gap = state.checkpointMs === null ? -1 : now - state.checkpointMs;
  const counted = gap >= 0 && gap <= WOKE_PAST_DEADLINE_MS ? gap : 0;
  return { elapsedMs: state.elapsedMs + counted, checkpointMs: now };
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

  // No time limit: the time used as counted up. Bounded only so a page left
  // ticking for days cannot fail the server's sanity check on the send.
  if (state.untimed) {
    const runningSeconds = state.modulePhase === 'pending' ? 0 : state.elapsedSeconds;
    return Math.min(MAX_UNTIMED_TIME_SPENT_SECONDS, finishedSeconds + runningSeconds);
  }

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

      initializeExam: (testId, modules, ownerId, title, untimed) =>
        set((state) => {
          if (modules.length === 0) return {};

          const moduleDurations = modules.map((item) => item.durationSeconds);
          const ownedByAnother = state.ownerId !== null && state.ownerId !== ownerId;

          // A submitted attempt is never resumed: the next visit is a new
          // attempt that starts module 1 on a fresh clock. Neither is another
          // account's attempt left in this browser.
          if (state.activeTestId !== testId || state.isSubmitted || ownedByAnother) {
            // This student's own answers on another test are not thrown away
            // by opening this one: nothing is loaded, and the exam screen asks
            // first. `startNewAttempt` replaces the attempt once they agree.
            if (
              state.activeTestId !== null &&
              state.activeTestId !== testId &&
              !state.isSubmitted &&
              !ownedByAnother &&
              hasAnyAnswer(state.answers)
            ) {
              return {
                blockingAttempt: { testId: state.activeTestId, title: state.activeTestTitle },
                isAttemptLoaded: false,
              };
            }

            return createAttempt(testId, moduleDurations, ownerId, title, untimed);
          }

          const now = Date.now();
          const moduleIndex = Math.min(state.currentModuleIndex, modules.length);
          const activeModule = modules[moduleIndex - 1];
          const lastQuestionIndex = Math.max(activeModule.questionIds.length - 1, 0);

          // An attempt saved before attempts had ids gets one on resume.
          const attemptId = state.attemptId ?? createAttemptId();
          // Claimed on resume: an attempt saved before owners existed becomes this
          // student's, so the shared-computer guard covers it from now on. The
          // title is taken again too, in case the test was renamed.
          const claimed = { ownerId: state.ownerId ?? ownerId, activeTestTitle: title };

          if (state.modulePhase === 'pending') {
            return {
              attemptId,
              ...claimed,
              moduleDurations,
              currentModuleIndex: moduleIndex,
              moduleDurationSeconds: activeModule.durationSeconds,
              timeLeftSeconds: activeModule.durationSeconds,
              endsAtMs: null,
              untimed,
              elapsedMs: 0,
              checkpointMs: null,
              elapsedSeconds: 0,
              currentQuestionIndex: 0,
              isAttemptLoaded: true,
              ranOutWhileAway: false,
            };
          }

          // No time limit: the module carries on counting up. A reload a
          // moment ago counts as time used, a return tomorrow does not
          // (advanceElapsed). If an admin took the limit off since the module
          // started, it carries on from what the clock had used.
          if (untimed) {
            const elapsed = state.untimed
              ? advanceElapsed(state, now)
              : {
                elapsedMs: state.endsAtMs === null
                  ? 0
                  : Math.min(
                    state.moduleDurationSeconds * 1000,
                    Math.max(0, state.moduleDurationSeconds * 1000 - (state.endsAtMs - now))
                  ),
                checkpointMs: now,
              };

            return {
              attemptId,
              ...claimed,
              moduleDurations,
              currentModuleIndex: moduleIndex,
              moduleDurationSeconds: activeModule.durationSeconds,
              timeLeftSeconds: activeModule.durationSeconds,
              endsAtMs: null,
              untimed: true,
              ...elapsed,
              elapsedSeconds: Math.floor(elapsed.elapsedMs / 1000),
              currentQuestionIndex: Math.min(state.currentQuestionIndex, lastQuestionIndex),
              isAttemptLoaded: true,
              ranOutWhileAway: false,
            };
          }

          // The module's deadline, moved along with its duration if an admin
          // changed that since the module started. A module that started with
          // no time limit, which an admin has given one since, counts the time
          // it has used against it.
          const deadlineMs = state.untimed
            ? now + activeModule.durationSeconds * 1000 - advanceElapsed(state, now).elapsedMs
            : state.endsAtMs === null
              ? null
              : state.endsAtMs + (activeModule.durationSeconds - state.moduleDurationSeconds) * 1000;
          const timed = { untimed: false, elapsedMs: 0, checkpointMs: null, elapsedSeconds: 0 };

          // Past the deadline by more than the grace period: the clock ran
          // out while the test was closed - the student left yesterday and is
          // opening it again today - not during a reload in the module's last
          // seconds, which still ends the module as usual.
          if (deadlineMs !== null && now - deadlineMs > EXAM_TIME_GRACE_SECONDS * 1000) {
            if (!hasAnyAnswer(state.answers)) {
              return createAttempt(testId, moduleDurations, ownerId, title, untimed);
            }

            return {
              attemptId,
              ...claimed,
              moduleDurations,
              currentModuleIndex: moduleIndex,
              moduleDurationSeconds: activeModule.durationSeconds,
              timeLeftSeconds: 0,
              // Kept as the deadline rather than reset to now, so a reload on
              // the question screen asks again instead of ending the module.
              endsAtMs: deadlineMs,
              ...timed,
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
            ...claimed,
            moduleDurations,
            currentModuleIndex: moduleIndex,
            moduleDurationSeconds: activeModule.durationSeconds,
            timeLeftSeconds,
            endsAtMs: timeLeftSeconds > 0 ? now + timeLeftSeconds * 1000 : now,
            ...timed,
            currentQuestionIndex: Math.min(state.currentQuestionIndex, lastQuestionIndex),
            isAttemptLoaded: true,
            ranOutWhileAway: false,
          };
        }),

      unloadExam: () => set({
        isAttemptLoaded: false,
        ranOutWhileAway: false,
        blockingAttempt: null,
        isReviewOpen: false,
      }),

      startSending: (attemptId) => set({ sendingAttemptId: attemptId }),

      // Only the send that started it ends it: a slow answer for an attempt
      // the student has since replaced must not clear the next one's.
      stopSending: (attemptId) =>
        set((state) => (state.sendingAttemptId === attemptId ? { sendingAttemptId: null } : {})),

      // Abandoning an attempt is already free - attempts only count once they
      // are submitted, and opening another test discards the saved one once
      // the student agrees - so offering it here opens no new way around the
      // clock. Also how another test's attempt is discarded (`blockingAttempt`).
      startNewAttempt: (testId, modules, ownerId, title, untimed) =>
        set(() => (
          modules.length === 0
            ? {}
            : createAttempt(testId, modules.map((item) => item.durationSeconds), ownerId, title, untimed)
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

          const now = Date.now();

          return {
            modulePhase: 'active' as ModulePhase,
            timeLeftSeconds: state.moduleDurationSeconds,
            // No time limit: nothing counts down; the time used counts up from now.
            endsAtMs: state.untimed ? null : now + state.moduleDurationSeconds * 1000,
            elapsedMs: 0,
            checkpointMs: state.untimed ? now : null,
            elapsedSeconds: 0,
            currentQuestionIndex: 0,
            isReviewOpen: false,
          };
        }),

      finishCurrentModule: () =>
        set((state) => {
          const nextModuleIndex = state.currentModuleIndex + 1;
          const nextDuration = state.moduleDurations[nextModuleIndex - 1];

          // The last module ends with the submission, not with a handover.
          if (nextDuration === undefined) return {};

          const spentSeconds = state.untimed
            ? Math.round(advanceElapsed(state, Date.now()).elapsedMs / 1000)
            : Math.min(
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
            elapsedMs: 0,
            checkpointMs: null,
            elapsedSeconds: 0,
            currentQuestionIndex: 0,
            isReviewOpen: false,
          };
        }),

      setAnswer: (questionId, answer) =>
        set((state) => ({
          answers: { ...state.answers, [questionId]: answer },
          crossedOut: uncross(state.crossedOut, questionId, readLetters(answer)),
        })),

      /**
       * Adds or removes one choice on a multi-select question. The selection
       * stays a plain string - sorted letters joined by commas, the same form
       * the answer key uses - so a saved attempt from before multi-select
       * still rehydrates and the submit payload keeps its shape.
       */
      toggleAnswerChoice: (questionId, letter) =>
        set((state) => {
          const selected = readLetters(state.answers[questionId]);

          if (selected.has(letter)) selected.delete(letter);
          else selected.add(letter);

          return {
            answers: { ...state.answers, [questionId]: [...selected].sort().join(',') },
            crossedOut: uncross(state.crossedOut, questionId, selected),
          };
        }),

      toggleMarkForReview: (questionId) =>
        set((state) => ({
          markedForReview: {
            ...state.markedForReview,
            [questionId]: !state.markedForReview[questionId]
          }
        })),

      /**
       * Ruling out a choice the student had picked also takes it out of the
       * answer, the way a crossed-out answer on paper is no longer the answer.
       */
      toggleCrossOut: (questionId, letter) =>
        set((state) => {
          const crossed = state.crossedOut[questionId] ?? [];

          if (crossed.includes(letter)) {
            return { crossedOut: uncross(state.crossedOut, questionId, [letter]) };
          }

          const crossedOut = { ...state.crossedOut, [questionId]: [...crossed, letter].sort() };
          const selected = readLetters(state.answers[questionId]);
          if (!selected.has(letter)) return { crossedOut };

          selected.delete(letter);
          return {
            crossedOut,
            answers: { ...state.answers, [questionId]: [...selected].sort().join(',') },
          };
        }),

      setCurrentQuestionIndex: (index) =>
        set(() => ({ currentQuestionIndex: Math.max(0, index) })),

      setReviewOpen: (open) => set({ isReviewOpen: open }),

      syncTimeLeft: () =>
        set((state) => {
          if (state.modulePhase !== 'active' || state.ranOutWhileAway) return {};

          const now = Date.now();

          // No time limit: the time used counts up, and nothing ever runs out.
          // The saved count moves on only every CHECKPOINT_MS, or when a gap
          // shows the page was asleep; between those only the live value
          // changes, which is not saved.
          if (state.untimed) {
            const gap = state.checkpointMs === null ? -1 : now - state.checkpointMs;
            if (gap < 0 || gap >= CHECKPOINT_MS) {
              const elapsed = advanceElapsed(state, now);
              return { ...elapsed, elapsedSeconds: Math.floor(elapsed.elapsedMs / 1000) };
            }
            return { elapsedSeconds: Math.floor((state.elapsedMs + gap) / 1000) };
          }

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
            // keeps waiting: the attempt is replaced, or the student asked
            // about it, when they are back to see it - not by a hidden tab
            // woken overnight with nobody watching.
            const isSending = state.sendingAttemptId !== null
              && state.sendingAttemptId === state.attemptId;
            if (isPageHidden() || isSending) return {};

            return hasAnyAnswer(state.answers)
              ? { timeLeftSeconds: 0, ranOutWhileAway: true }
              : createAttempt(
                state.activeTestId,
                state.moduleDurations,
                state.ownerId,
                state.activeTestTitle,
                state.untimed
              );
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
      // A field added here needs no version bump: an attempt saved without it
      // is merged over the initial state, which supplies the empty default,
      // whereas a bump would discard every attempt in progress.
      partialize: (state) => ({
        activeTestId: state.activeTestId,
        activeTestTitle: state.activeTestTitle,
        ownerId: state.ownerId,
        attemptId: state.attemptId,
        answers: state.answers,
        markedForReview: state.markedForReview,
        crossedOut: state.crossedOut,
        moduleDurations: state.moduleDurations,
        moduleTimeSpent: state.moduleTimeSpent,
        currentModuleIndex: state.currentModuleIndex,
        modulePhase: state.modulePhase,
        moduleDurationSeconds: state.moduleDurationSeconds,
        // `timeLeftSeconds` is derived from `endsAtMs` on the next visit, and
        // keeping it out is what makes a timer tick serialize to the same
        // string as the tick before it.
        endsAtMs: state.endsAtMs,
        // With no time limit: the saved count and when it was taken, so a
        // reload carries on from it. `elapsedSeconds` is the live value and,
        // like `timeLeftSeconds`, is not saved.
        untimed: state.untimed,
        elapsedMs: state.elapsedMs,
        checkpointMs: state.checkpointMs,
        currentQuestionIndex: state.currentQuestionIndex,
        isSubmitted: state.isSubmitted,
      }),
    }
  )
);
