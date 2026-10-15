"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { flushPendingAnswer } from '@/components/exam/pendingAnswer';
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

/**
 * Sends the whole test - every module - as one result. Shared by the header,
 * the footer and the expired-attempt notice so every finish path behaves
 * identically; the send itself is tracked once, in the store
 * (`sendingAttemptId`), so the copies of this hook cannot each send it.
 */
export function useExamSubmit(testId: string) {
  const router = useRouter();
  const markSubmitted = useExamStore((state) => state.markSubmitted);
  const startSending = useExamStore((state) => state.startSending);
  const stopSending = useExamStore((state) => state.stopSending);
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

  const submitExam = useCallback(async (confirmMessage?: string) => {
    // Only this test's own attempt, and only once. The store outlives the
    // page, so what it holds can be another test's attempt, or this test's
    // previous one that was already sent: sending either created a result
    // the student never submitted.
    const { activeTestId, attemptId, isAttemptLoaded, isSubmitted, sendingAttemptId } =
      useExamStore.getState();
    if (!isAttemptLoaded || activeTestId !== testId || isSubmitted || !attemptId) return;
    if (sendingAttemptId === attemptId) return;

    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

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
        }),
      });

      // A JWT session outlives its user row, so a deleted account reaches this
      // point with a valid cookie. Sending them back to sign in beats leaving
      // them stranded on an exam they can no longer submit.
      if (response.status === 401) {
        alert("Your session is no longer valid. Please sign in again.");
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      // A proxy error yields HTML, not JSON, so parsing must not throw us into
      // the generic "check your connection" branch.
      const data = await response.json().catch(() => null);
      const isSaved = Boolean(response.ok && data?.success);

      // Recorded whenever the store still holds this attempt, even with the
      // exam screen gone - the student pressed Back while it was sending -
      // or reopening the test would resume it and send it a second time.
      const { activeTestId: latestTestId, attemptId: latestAttemptId } = useExamStore.getState();
      if (isSaved && latestTestId === testId && latestAttemptId === attemptId) {
        markSubmitted();
      }

      if (!isStillOnAttempt(testId, attemptId)) {
        // The student has moved on. Pulling them away from what is on screen
        // now, or alerting over it, would be read as being about that. A
        // saved result is on the results page either way.
        if (!isSaved) {
          console.error('Submit failed after leaving the attempt:', data?.error ?? response.status);
        }
        return;
      }

      if (isSaved) {
        router.push(`/dashboard/results/${data.resultId}`);
      } else {
        alert(data?.error || "Failed to submit results. Please try again.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      if (isStillOnAttempt(testId, attemptId)) {
        alert("An error occurred. Check your connection.");
      }
    } finally {
      stopSending(attemptId);
    }
  }, [markSubmitted, router, startSending, stopSending, testId]);

  return { isSubmitting, submitExam };
}
