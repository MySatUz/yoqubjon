"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExamStore } from '@/store/useExamStore';
import ReferenceModal from '@/components/exam/ReferenceModal';
import { BookOpen, Calculator } from 'lucide-react';

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
    syncTimeLeft,
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
    syncTimeLeft();
    const interval = setInterval(syncTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [syncTimeLeft]);

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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m}:${s}`;
    }

    return `${m}:${s}`;
  };

  return (
    <>
      <header className="relative h-14 bg-white border-b border-slate-200 flex items-center justify-between gap-2 px-2 sm:px-4 sticky top-0 z-50 shrink-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <h1 className="hidden font-bold text-slate-900 tracking-tight sm:block">MYSATuz</h1>
          <span className="truncate text-xs font-bold text-slate-900 uppercase tracking-widest sm:text-sm">
            <span className="sm:hidden">Q {currentQuestionIndex + 1}</span>
            <span className="hidden sm:inline">Question {currentQuestionIndex + 1}</span>
          </span>
        </div>
        
        <div className="flex flex-col items-center sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <span className="rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-base font-bold tabular-nums text-slate-900 shadow-sm sm:px-4 sm:text-lg">{formatTime(timeLeftSeconds)}</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          <button
            onClick={() => setReferenceOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 sm:hidden"
            aria-label="Reference Sheet"
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCalculatorOpen(!isCalculatorOpen)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors sm:hidden ${
              isCalculatorOpen ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
            }`}
            aria-label={isCalculatorOpen ? 'Close Calculator' : 'Graphing Calculator'}
          >
            <Calculator className="h-4 w-4" />
          </button>
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
            className="rounded px-2 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 sm:px-3 sm:text-sm"
          >
            {isSubmitting ? 'Submitting...' : <><span className="sm:hidden">End</span><span className="hidden sm:inline">End Section</span></>}
          </button>
        </div>
      </header>

      <ReferenceModal isOpen={isReferenceOpen} onClose={() => setReferenceOpen(false)} />
    </>
  );
}
