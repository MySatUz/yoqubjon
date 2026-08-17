"use client";

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { flushPendingAnswer } from '@/components/exam/pendingAnswer';
import { selectTotalTimeSpent, useExamStore } from '@/store/useExamStore';

/**
 * Sends the whole test - every module - as one result. Shared by the header
 * and the footer so both finish paths behave identically.
 */
export function useExamSubmit(testId: string) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const markSubmitted = useExamStore((state) => state.markSubmitted);

  const submitExam = useCallback(async (confirmMessage?: string) => {
    if (isSubmitting) return;

    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    setIsSubmitting(true);
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
      if (response.ok && data?.success) {
        markSubmitted();
        router.push(`/dashboard/results/${data.resultId}`);
      } else {
        alert(data?.error || "Failed to submit results. Please try again.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("An error occurred. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, markSubmitted, router, testId]);

  return { isSubmitting, submitExam };
}
