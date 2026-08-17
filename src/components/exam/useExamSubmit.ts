"use client";

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { selectTotalTimeSpent, useExamStore } from '@/store/useExamStore';

/**
 * Sends the whole test - every module - as one result. Shared by the header
 * and the footer so both finish paths behave identically.
 */
export function useExamSubmit(testId: string) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const answers = useExamStore((state) => state.answers);
  const timeSpent = useExamStore(selectTotalTimeSpent);
  const markSubmitted = useExamStore((state) => state.markSubmitted);

  const submitExam = useCallback(async (confirmMessage?: string) => {
    if (isSubmitting) return;

    if (confirmMessage && !confirm(confirmMessage)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId,
          answers,
          timeSpent: Math.max(0, Math.round(timeSpent)),
        }),
      });

      const data = await response.json();
      if (data.success) {
        markSubmitted();
        router.push(`/dashboard/results/${data.resultId}`);
      } else {
        alert(data.error || "Failed to submit results. Please try again.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("An error occurred. Check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, isSubmitting, markSubmitted, router, testId, timeSpent]);

  return { isSubmitting, submitExam };
}
