"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { flushPendingAnswer } from '@/components/exam/pendingAnswer';
import { useConfirm, type ConfirmOptions } from '@/components/ui/Dialog';
import { selectTotalTimeSpent, useExamStore } from '@/store/useExamStore';

/**
 * Whether the store still holds this test's attempt `attemptId`, loaded on
 * the page. A slow answer can arrive after the student has moved on to
 * another test, and nothing about that attempt is theirs to act on any more.
 */
function isStillOnAttempt(testId: string, attemptId: string) {
  const state = useExamStore.getState();
  return state.isAttemptLoaded && state.activeTestId === testId && state.attemptId === attemptId;
}

/** What the student is told after a send that did not reach the result page. */
type Outcome =
  | { kind: 'signIn' }
  | { kind: 'refused'; message: string }
  | { kind: 'failed'; message: string };

/** Server messages are bare phrases ("Test not found"); a dialog reads them as sentences. */
function asSentence(message: string) {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

/**
 * Sends the whole test - every module - as one result. Shared by the header,
 * the footer and the expired-attempt notice so every finish path behaves
 * identically; the send itself is tracked once, in the store
 * (`sendingAttemptId`), so the copies of this hook cannot each send it.
 *
 * Asking before sending is the caller's job (see "Check your work" in
 * `BottomNav`); this only reports what went wrong, in `submitDialog`, which
 * the caller renders.
 */
export function useExamSubmit(testId: string) {
  const router = useRouter();
  const markSubmitted = useExamStore((state) => state.markSubmitted);
  const startSending = useExamStore((state) => state.startSending);
  const stopSending = useExamStore((state) => state.stopSending);
  const { confirm: ask, dialog: submitDialog } = useConfirm();
  // Busy from the moment the result is sent until the page has moved on to
  // it - not only until the server answered, which left the buttons live
  // while the result page was still loading. Only for this test's own
  // attempt: the store can still hold the previous one when the page opens.
  const isSubmitting = useExamStore((state) => (
    state.isAttemptLoaded
    && state.activeTestId === testId
    && state.attemptId !== null
    && (state.isSubmitted || state.sendingAttemptId === state.attemptId)
  ));
  // "Try again" in the failure dialog sends through the latest copy of this.
  const submitRef = useRef<() => Promise<void>>(async () => {});

  const submitExam = useCallback(async () => {
    // Only this test's own attempt, and only once. The store outlives the
    // page, so what it holds can be another test's attempt, or this test's
    // previous one that was already sent: sending either created a result
    // the student never submitted.
    const { activeTestId, attemptId, isAttemptLoaded, isSubmitted, sendingAttemptId } =
      useExamStore.getState();
    if (!isAttemptLoaded || activeTestId !== testId || isSubmitted || !attemptId) return;
    if (sendingAttemptId === attemptId) return;

    let outcome: Outcome | null = null;

    startSending(attemptId);
    try {
      // Read at submit time instead of subscribing: the answers and the clock
      // change every second and would rebuild this callback along with them.
      flushPendingAnswer();
      const state = useExamStore.getState();
      const answers = state.answers;
      const timeSpent = selectTotalTimeSpent(state);

      const response = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          // Lets the server answer a second send of this attempt - a reload
          // while this one is out, another tab, a retry after a lost
          // response - with the result it already filed.
          attemptId,
          answers,
          timeSpent: Math.max(0, Math.round(timeSpent)),
          ownerId: state.ownerId,
        }),
      });

      // A JWT session outlives its user row, so a deleted account reaches this
      // point with a valid cookie. Sending them back to sign in beats leaving
      // them stranded on an exam they can no longer submit.
      if (response.status === 401) {
        outcome = { kind: 'signIn' };
      } else {
        // A proxy error yields HTML, not JSON, so parsing must not throw us into
        // the generic "check your connection" branch.
        const data = await response.json().catch(() => null);

        if (response.status === 409) {
          // Another account's attempt (see createExamResult), or the attempt
          // limit. Reloading opens the test for whoever is signed in now,
          // which starts them a fresh attempt or shows them the limit.
          outcome = {
            kind: 'refused',
            message: data?.error || 'This test was started by another account, so it was not saved.',
          };
        } else {
          const isSaved = Boolean(response.ok && data?.success);

          // Recorded whenever the store still holds this attempt, even with the
          // exam screen gone - the student pressed Back while it was sending -
          // or reopening the test would resume it and send it a second time.
          const { activeTestId: latestTestId, attemptId: latestAttemptId } = useExamStore.getState();
          if (isSaved && latestTestId === testId && latestAttemptId === attemptId) {
            markSubmitted();
          }

          if (isSaved) {
            if (isStillOnAttempt(testId, attemptId)) {
              router.push(`/dashboard/results/${data.resultId}`);
            }
          } else {
            outcome = { kind: 'failed', message: data?.error || 'The server could not save the result.' };
          }
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      outcome = { kind: 'failed', message: 'Check your internet connection.' };
    } finally {
      stopSending(attemptId);
    }

    if (!outcome) return;

    // Wherever the student is now: no page of the app works without a session.
    if (outcome.kind === 'signIn') {
      await ask({
        title: 'Please sign in again',
        description: 'Your session is no longer valid, so your answers were not sent. They are still saved in this browser.',
        confirmLabel: 'Sign in',
        cancelLabel: null,
      });
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    // The student has moved on. Pulling them away from what is on screen
    // now, or putting a dialog over it, would be read as being about that.
    // A saved result is on the results page either way.
    if (!isStillOnAttempt(testId, attemptId)) {
      console.error('Submit failed after leaving the attempt:', outcome.message);
      return;
    }

    if (outcome.kind === 'refused') {
      await ask({
        title: 'This attempt was not saved',
        description: asSentence(outcome.message),
        // The only button, and pressing it reloads the test: it says so.
        confirmLabel: 'Reload the test',
        cancelLabel: null,
      });
      if (isStillOnAttempt(testId, attemptId)) window.location.reload();
      return;
    }

    const retry: ConfirmOptions = {
      title: 'Your answers were not sent',
      description: `${asSentence(outcome.message)} Your answers are still saved in this browser, so nothing is lost. Try again in a moment.`,
      confirmLabel: 'Try again',
      cancelLabel: 'Close',
    };
    if (await ask(retry)) void submitRef.current();
  }, [ask, markSubmitted, router, startSending, stopSending, testId]);

  useEffect(() => {
    submitRef.current = submitExam;
  }, [submitExam]);

  return { isSubmitting, submitExam, submitDialog };
}
