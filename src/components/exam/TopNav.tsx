"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExamStore } from '@/store/useExamStore';
import ReferenceModal from '@/components/exam/ReferenceModal';

interface TopNavProps {
  testId: string;
  questionIds: string[];
  initialTimeSeconds: number;
}

export default function TopNav({ testId, questionIds, initialTimeSeconds }: TopNavProps) {
  const router = useRouter();
  const { 
    timeLeftSeconds, 
    initializeExam,
    resetExam,
    decrementTime, 
    isCalculatorOpen, 
    setCalculatorOpen,
    isReferenceOpen,
    setReferenceOpen,
    answers,
    currentQuestionIndex,
  } = useExamStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    initializeExam(testId, initialTimeSeconds, questionIds);
  }, [initializeExam, initialTimeSeconds, questionIds, testId]);

  useEffect(() => {
    const interval = setInterval(() => {
      decrementTime();
    }, 1000);
    return () => clearInterval(interval);
  }, [decrementTime]);

  const submitSection = useCallback(async (requireConfirmation: boolean) => {
    if (isSubmitting) return;

    if (
      requireConfirmation &&
      !confirm("Are you sure you want to end this section? Your answers will be saved.")
    ) {
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
          timeSpent: initialTimeSeconds - timeLeftSeconds
        })
      });

      const data = await response.json();
      if (data.success) {
        resetExam(testId, initialTimeSeconds);
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
  }, [
    answers,
    initialTimeSeconds,
    isSubmitting,
    resetExam,
    router,
    testId,
    timeLeftSeconds,
  ]);

  useEffect(() => {
    if (timeLeftSeconds > 0 || autoSubmittedRef.current) return;

    autoSubmittedRef.current = true;
    void submitSection(false);
  }, [submitSection, timeLeftSeconds]);

  const handleEndSection = async () => {
    if (timeLeftSeconds === 0) {
      void submitSection(false);
    } else {
      void submitSection(true);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-slate-900 tracking-tight">MYSATuz</h1>
          <span className="text-sm font-bold text-slate-900 uppercase tracking-widest">Question {currentQuestionIndex + 1}</span>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className="text-lg font-bold tabular-nums text-slate-900 bg-slate-50 px-4 py-1 rounded-full border border-slate-100 shadow-sm">{formatTime(timeLeftSeconds)}</span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setReferenceOpen(true)}
            className="text-sm font-medium text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded transition-colors hidden sm:inline-block"
          >
            Reference Sheet
          </button>
          <button 
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            className={`text-sm font-medium px-3 py-1.5 rounded transition-colors hidden sm:inline-block ${
              isCalculatorOpen ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isCalculatorOpen ? 'Close Calculator' : 'Graphing Calculator'}
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
          <button 
            onClick={handleEndSection}
            disabled={isSubmitting}
            className="text-sm font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'End Section'}
          </button>
        </div>
      </header>

      <ReferenceModal isOpen={isReferenceOpen} onClose={() => setReferenceOpen(false)} />
    </>
  );
}
